#!/bin/bash
# 东京服务器：构建完成后执行 —— nginx 80 接入 + acme.sh 证书 + 8443 HTTPS 反代
set -u
echo "=== [1/4] 容器健康 ==="
curl -s -m 5 -o /dev/null -w "healthz=%{http_code}\n" http://127.0.0.1:8080/healthz
docker ps --format "{{.Names}} {{.Status}}" 2>/dev/null

echo "=== [2/4] nginx 80 口接入（ACME 通道 + 跳转） ==="
mkdir -p /usr/share/nginx/html
cat > /etc/nginx/conf.d/anywork-80.conf <<'EOF'
server {
    listen 80;
    server_name anywork.your-domain.com;
    location /.well-known/acme-challenge/ { root /usr/share/nginx/html; }
    location / { return 301 https://$host:8443$request_uri; }
}
EOF
nginx -t && systemctl reload nginx && echo "80 口 OK"

echo "=== [3/4] 签发证书（acme.sh webroot，不停 nginx） ==="
if [ ! -x /root/.acme.sh/acme.sh ]; then
  curl -s https://get.acme.sh | sh -s email=admin@your-domain.com >/dev/null 2>&1 || echo "acme.sh 安装异常"
fi
/root/.acme.sh/acme.sh --set-default-ca --server letsencrypt 2>&1 | tail -1
/root/.acme.sh/acme.sh --issue -d anywork.your-domain.com --webroot /usr/share/nginx/html --keylength ec-256 2>&1 | tail -8
mkdir -p /etc/nginx/ssl
/root/.acme.sh/acme.sh --install-cert -d anywork.your-domain.com --ecc \
  --fullchain-file /etc/nginx/ssl/anywork.crt \
  --key-file /etc/nginx/ssl/anywork.key \
  --reloadcmd "systemctl reload nginx" 2>&1 | tail -3
ls -la /etc/nginx/ssl/ 2>/dev/null

echo "=== [4/4] nginx 8443 HTTPS 反代 ==="
cat > /etc/nginx/conf.d/anywork-8443.conf <<'EOF'
map $http_upgrade $connection_upgrade_anywork { default upgrade; '' close; }
server {
    listen 8443 ssl;
    server_name anywork.your-domain.com;
    ssl_certificate     /etc/nginx/ssl/anywork.crt;
    ssl_certificate_key /etc/nginx/ssl/anywork.key;
    client_max_body_size 100m;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade_anywork;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_buffering off;
    }
}
EOF
nginx -t && systemctl reload nginx && echo "8443 OK"
curl -sk -m 8 -o /dev/null -w "本机 8443 测试: %{http_code}\n" https://127.0.0.1:8443/ -H "Host: anywork.your-domain.com"
echo "=== HTTPS 配置完成 ==="

---
title: "9. 쿠버네티스 배포-ArgoCD 구성"
weight: 9
date: 2025-03-18
draft: false
---

## 9-1 ArgoCD 서버 설치
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

## 9-2 로드밸런서 추가하기
```bash
kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "LoadBalancer"}}'
```

## 9-3 ArgoCD CLI 설치
### Linux
```bash
# latest Version
curl -sSL -o argocd-linux-amd64 https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
sudo install -m 555 argocd-linux-amd64 /usr/local/bin/argocd
rm argocd-linux-amd64

# stable Version
VERSION=$(curl -L -s https://raw.githubusercontent.com/argoproj/argo-cd/stable/VERSION)
curl -sSL -o argocd-linux-amd64 https://github.com/argoproj/argo-cd/releases/download/v$VERSION/argocd-linux-amd64
sudo install -m 555 argocd-linux-amd64 /usr/local/bin/argocd
rm argocd-linux-amd64
```
### Windows
```bash
$version = (Invoke-RestMethod https://api.github.com/repos/argoproj/argo-cd/releases/latest).tag_name
$url = "https://github.com/argoproj/argo-cd/releases/download/" + $version + "/argocd-windows-amd64.exe"
$output = "argocd.exe"

Invoke-WebRequest -Uri $url -OutFile $output
```
### Mac
```bash
brew install argocd
```

## 9-4 Argocd 서버 설정
### Admin 패스워드 알아내기
```bash
argocd admin initial-password -n argocd
```
### 접속 Endpoint 알아내기
```bash
kubectl get svc argocd-server -n argocd

###### 출력 예시 ######
NAME            TYPE           CLUSTER-IP      EXTERNAL-IP                                                                    PORT(S)                      AGE
argocd-server   LoadBalancer   172.20.21.170   a7eb417c510ec4551933abc911356e6e-1770617535.ap-northeast-2.elb.amazonaws.com   80:31698/TCP,443:31412/TCP   103s
```
### Argocd CLI 로그인
```bash
argocd login <EXTERNAL-IP>

###### 출력 예시 ######
WARNING: server certificate had error: tls: failed to verify certificate: x509: certificate signed by unknown authority. Proceed insecurely (y/n)? y
Username: admin
Password: 
'admin:login' logged in successfully
Context 'a7eb417c510ec4551933abc911356e6e-1770617535.ap-northeast-2.elb.amazonaws.com' updated
```

### 새로운 패스워드로 변경
```bash
argocd account update-password --current-password <현재패스워드> --new-password <새로운패스워드>
```

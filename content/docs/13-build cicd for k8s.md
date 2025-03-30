---
title: "9. 쿠버네티스 배포-ArgoCD 구성"
weight: 9
date: 2025-03-18
draft: false
---

## 1 ArgoCD 서버 설치
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

## 2 로드밸런서 추가하기
```bash
# Patch일 경우 Annotation이 없어서 Classic LB가 생성되기 때문에 외부 접속 가능
# 일반적으로 Patch가 아니라 Create일 경우 Network LB 생성되고, 이때는 Annotation 있어야함.
kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "LoadBalancer"}}'
```

## 3 ArgoCD CLI 설치
웹 VSCODE IDE를 사용하는 경우 이미 설치 되어 있음
### 3.1 Linux
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
### 3.2 Windows
```bash
$version = (Invoke-RestMethod https://api.github.com/repos/argoproj/argo-cd/releases/latest).tag_name
$url = "https://github.com/argoproj/argo-cd/releases/download/" + $version + "/argocd-windows-amd64.exe"
$output = "argocd.exe"

Invoke-WebRequest -Uri $url -OutFile $output
```
### 3.3 Mac
```bash
brew install argocd
```

## 4 Argocd 서버 설정
### 4.1 Admin 패스워드 알아내기
```bash
argocd admin initial-password -n argocd
```
### 4.2 접속 Endpoint 알아내기
```bash
kubectl get svc argocd-server -n argocd

###### 출력 예시 ######
NAME            TYPE           CLUSTER-IP      EXTERNAL-IP                                                                    PORT(S)                      AGE
argocd-server   LoadBalancer   172.20.21.170   a7eb417c510ec4551933abc911356e6e-1770617535.ap-northeast-2.elb.amazonaws.com   80:31698/TCP,443:31412/TCP   103s
```
### 4.3 Argocd CLI 로그인
```bash
argocd login <EXTERNAL-IP>

###### 출력 예시 ######
WARNING: server certificate had error: tls: failed to verify certificate: x509: certificate signed by unknown authority. Proceed insecurely (y/n)? y
Username: admin
Password: 
'admin:login' logged in successfully
Context 'a7eb417c510ec4551933abc911356e6e-1770617535.ap-northeast-2.elb.amazonaws.com' updated
```

### 4.4 새로운 패스워드로 변경
```bash
argocd account update-password --current-password <현재패스워드> --new-password <새로운패스워드>
```

## 5 브라우저 기반 설정
### 5.1 리포지토리 설정
- 웹 메뉴 : `Settings` → `Repositories` → `CONNECT REPO` 
| 설정 항목 | 값 | 설명 |
|-----------------------|----------------------|---------------------|
| connection method | VIA HTTPS | Git 리포지토리 접속 방식 |
| Type | git | 리포지토리 타입(git | Helm) |
| Name | istory-dev | 참조 이름 |
| Project | Default | Git 의 브렌치 이름 |
| Repository URL | `https://github.com/<github-id>/istory-platform.git` | Platform 리포지토리 URL |
<br>
- 설정화면 참조
{{< figure src="/cicd-textbook/images/argocd-repo1.png" alt="argocd 리포지토리 설정" class="img-fluid" width="60%" >}}

### 5.2 애플리케이션 설정
- 웹 메뉴 : `Application` → `NEW APP`

| 설정 항목 | 값 | 설명 |
|-----------------------|----------------------|---------------------|
| Application Name | istory-dev | - |
| Project Name | default | - |
| Repository URL | `https://github.com/<github-id>/istory-platform.git` | - |
| Path | overlay | aws-dev |
| Cluster URL | https://kubernetes.default.svc | - |
| Namespace | istory-dev | - |
<br>
- 설정 화면 참조 
{{< figure src="/cicd-textbook/images/argocd-application-1.png" alt="argocd 애플리케이션 설정1" class="img-fluid" width="60%" >}}
{{< figure src="/cicd-textbook/images/argocd-application-2.png" alt="argocd 애플리케이션 설정2" class="img-fluid" width="60%" >}}

### 5.3 데이터베이스 시크릿 생성 하기
데이터베이스 계정 및 패스워드는 **Github Action Secret**을 이용해서 동적으로 생성 하기 때문에 최초에 싱크 시에는 직접 **K8s Secret** 객체를 만들어야 함.
**Workflow** 에서는 **Github Action Secret** 을 참조해서 계속 업데이트(kubectl apply ...) 가능하도록 해야 함.
```bash
kubectl create secret generic istory-db-secret \
--namespace istory-dev \
--from-literal=MYSQL_USER=user \
--from-literal=MYSQL_PASSWORD=user12345 \ 
--from-literal=MYSQL_DATABASE=istory \
--from-literal=MYSQL_ROOT_PASSWORD=admin123
```
### 5.4 Sync 하기
- 웹 메뉴 : `Application` → `SYNC` → `Synchronize`
## 6 명령어 기반 설정 (추후 업데이트 예정)
추후 업데이트 예정 ...

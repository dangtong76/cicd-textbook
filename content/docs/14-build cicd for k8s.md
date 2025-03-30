---
title: "10. 쿠버네티스 배포-Workflow 구성"
weight: 10
date: 2025-03-18
draft: false
---

## 1. 워크플로우 환경 설정
### 1.1 워크 플로우 디렉토리 생성

```bash
mkdir -p .github/workflows
```
### 1.2 Create-Secret.sh 작성
파일 위치 : .github/workflows/create-secret.sh
```bash
gh api -X PUT repos/<your-github-id>/istory-web-k8s/environments/k8s-dev  --silent
gh secret set DATABASE_URL --env k8s-dev --body "jdbc:mysql:istory-db-lb:3306/istory"
gh secret set MYSQL_DATABASE --env k8s-dev --body "istory"
gh secret set MYSQL_USER --env k8s-dev --body "user"
gh secret set MYSQL_PASSWORD --env k8s-dev --body "user12345"
gh secret set MYSQL_ROOT_PASSWORD --env k8s-dev --body "admin123"
gh secret set DOCKER_USERNAME --env k8s-dev --body "<your-docker-hub-id>"
gh secret set DOCKER_TOKEN --env k8s-dev --body "<your-docker-hub-token"
gh secret set DOCKER_PASSWORD --env k8s-dev --body "<your-docker-password>"
gh secret set GIT_PAT --env k8s-dev --body "<your-github-access-token>"
```


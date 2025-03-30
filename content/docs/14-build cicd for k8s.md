---
title: "10. 쿠버네티스 배포-Workflow 구성"
weight: 10
date: 2025-03-18
draft: false
---

## 1. 워크플로우 환경 설정
### 1.1 Github 토큰생성
- Github Token 생성
`Profile` → `settings` → `< > Developer settings` → `🔑 Personal access tokens` → `Fine-grained tokens` → `Generate new token`

- 상세 입력 항목
| 입력 항목 | 입력 값 |
|----------------|------------------------------|
| Token name | personal_access_token |
| Repository access  | All repositories |
| Repository Permission | **Read and Write** for Actions, Administration, Codepsaces, Contents, Metadata, Pull requests, Secrets, Variables, Workflows | 

### 1.2 Docker Hub 토큰 생성

### 1.3 워크 플로우 디렉토리 생성

```bash
mkdir -p .github/workflows
```
### 1.4 Create-Secret.sh 작성
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

gh secret set GIT_ACCESS_TOKEN --env k8s-dev --body "<your-github-access-token>"
gh secret set GIT_USERNAME --env k8s-dev --body "<your-github-id>"
gh secret set GIT_APP_REPO_NAME --env k8s-dev --body "<your-githhub-repository-name>"
gh secret set GIT_PLATFORM_REPO_NAME --env k8s-dev --body "<your-githhub-repository-name>"

gh secret set CLUSTER_NAME --env k8s-dev --body "istory"
gh secret set AWS_ACCESS_KEY_ID --env k8s-dev --body "<your-aws-access-key-id>"
gh secret set AWS_SECRET_ACCESS_KEY --env k8s-dev --body "<your-aws-access-key>"
gh secret set AWS_REGION --env k8s-dev --body "<your-aws-region>"
```

## 2. Workflow 생성
### 2.1 MySQL 서비스 및 환경설정
```yml
name: Istory Deploy for AWS EKS 
on:
  push:
    branches: [ "main" ]
permissions:
  contents: read
  actions: read
  packages: write
jobs:
  build:
    if: contains(github.event.head_commit.message, '[deploy-dev]') # 특정 태그에만 실행
    runs-on: ubuntu-latest
    environment: k8s-dev # 환경 변수 및 시크릿 저장공간
    env:
      DOCKER_IMAGE: ${{ secrets.DOCKER_USERNAME }}/istory
      DOCKER_TAG: ${{ github.run_number }}
    services:
      mysql:
        image: mysql:8.0
        env:
          # root 계정 비밀번호
          MYSQL_ROOT_PASSWORD: ${{ secrets.MYSQL_ROOT_PASSWORD }} 
          # 사용자 계정
          MYSQL_USER: ${{ secrets.MYSQL_USER }} # user
          # 사용자 계정 비밀번호
          MYSQL_PASSWORD: ${{ secrets.MYSQL_PASSWORD }}
          # 사용자 계정 데이터베이스
          MYSQL_DATABASE: ${{ secrets.MYSQL_DATABASE }} # istory
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3
    steps:
      - name: AWS CLI ActionSet 설정
        uses: aws-actions/configure-aws-credentials@v3
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: kubectl 설치
        run: |
          curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
          chmod +x kubectl
          sudo mv kubectl /usr/local/bin/

      - name: kubeconfig 업데이트
        run: |
          aws eks update-kubeconfig --region ${{ secrets.AWS_REGION }} --name ${{ secrets.CLUSTER_NAME }}

      - name: kustomize 설치
        run: |
          curl -s https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh | bash
          sudo mv kustomize /usr/local/bin

      - name: JDK 17 설치
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
```

### 2.2 애플리케이션 빌드
```yml
      - name: 소스코드 다운로드
        uses: actions/checkout@v4 

      - name: 개발용 application.yml 생성
        run: |
          cat > src/main/resources/application.yml << EOF
          spring:
            datasource:
              # url: ${{ secrets.DATABASE_URL }} # 예dbc:mysql://localhost:3306/istory
              url: jdbc:mysql://localhost:3306/istory
              username: ${{ secrets.MYSQL_USER }}
              password: ${{ secrets.MYSQL_PASSWORD }}
              driver-class-name: com.mysql.cj.jdbc.Driver
            jpa:
              database-platform: org.hibernate.dialect.MySQL8Dialect
              hibernate:
                ddl-auto: update
              show-sql: true
            application:
              name: USER-SERVICE
            jwt:
              issuer: user@gmail.com
              secret_key: study-springboot
          management:
            endpoints:
              web:
                exposure:
                  include: health,info
            endpoint:
              health:
                show-details: always
          EOF

      - name: Gradle 설정
        uses: gradle/gradle-build-action@v2
        
      - name: 자바 빌드 wit TEST
        run: ./gradlew build

      - name: Docker 디렉토리로 jar 파일 복사
        run: |
          mkdir -p xinfra/docker/build/libs/
          cp build/libs/*.jar xinfra/docker/
          ls xinfra/docker/
```
### 2.3 컨테이너 빌드 및 업로드
```yml
      - name: 컨테이너 이미지 빌드
        run: | 
          docker build ./xinfra/docker -t ${{ secrets.DOCKER_USERNAME }}/istory:${{ env.DOCKER_TAG }} -f ./xinfra/docker/Dockerfile
          docker tag ${{ secrets.DOCKER_USERNAME }}/istory:${{ env.DOCKER_TAG }} ${{ secrets.DOCKER_USERNAME }}/istory:latest

      - name: Docker Hub 로그인
        uses: docker/login-action@v3.0.0
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_TOKEN }}
          logout: true

      - name: 9.Docker Hub 이미지 업로드
        run: |
          docker push ${{ secrets.DOCKER_USERNAME }}/istory:${{ env.DOCKER_TAG }}
          docker push ${{ secrets.DOCKER_USERNAME }}/istory:latest
```

### 2.4 이미지 태그 변경
```yml
      - name: 서비스 리포지토리 체크아웃
        uses: actions/checkout@v4
        with:
          repository: {{ secrets.GIT_USERNAME }}/{{ secrets.GIT_PLATFORM_REPO_NAME }}   # 바꾸기
          ref: main # 바꾸기
          path: .
          token: ${{ secrets.GIT_ACCESS_TOKEN }}

      - name: kubernetes secret 생성 (istory-db-secret)
        run: |
          kubectl create secret generic istory-db-secret \
            --from-literal=MYSQL_USER=${{ secrets.MYSQL_USER }} \
            --from-literal=MYSQL_PASSWORD=${{ secrets.MYSQL_PASSWORD }} \
            --from-literal=DATABASE_URL=${{ secrets.DATABASE_URL }} \
            --from-literal=MYSQL_ROOT_PASSWORD=${{ secrets.MYSQL_ROOT_PASSWORD }} \
            --namespace=default \
            --dry-run=client -o yaml | kubectl apply -f -

      - name: kustomize 이미지 태그 업데이트
        run: |
          cd overlay/aws-dev
          kustomize edit set image {{ secrets.DOCKER_USERNAME }}/istory={{ secrets.DOCKER_USERNAME }}/istory:$${{ env.DOCKER_TAG }}
      - name: push yaml
        run: |
          git config --global user.name 'github-actions[bot]'
          git config --global user.email 'github-actions[bot]@users.noreply.github.com'
          git commit -am "Update image tag to ${{ env.DOCKER_TAG }}"
          git push origin main

```



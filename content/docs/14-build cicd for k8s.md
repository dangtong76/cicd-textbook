---
title: "10. 쿠버네티스 배포-Workflow 구성"
weight: 10
date: 2025-03-18
draft: false
---

## 1. 워크플로우 환경 설정
### 1.1 자바 소스 수정
Github Action Workflow를 통해 빌드된 애플리케이션을 확인하기 위해 소스에 버전을 추가 합니다.
파일 위치 : `src/main/resources/templates/login.html`

**서비스를 사용하려면 로그인을 해주세요!** 뒷 부분에 배포 버전 추가 **V4.0**
```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org">
<head>
    <meta charset="UTF-8">
    <title>로그인</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.6.1/dist/css/bootstrap.min.css">

    <style>
        .gradient-custom {
            background: linear-gradient(to right, rgba(106, 17, 203, 1), rgba(37, 117, 252, 1))
        }
    </style>
</head>
<body class="gradient-custom">
<section class="d-flex vh-100">
    <div class="container-fluid row justify-content-center align-content-center">
        <div class="card bg-dark" style="border-radius: 1rem;">
            <div class="card-body p-5 text-center">
                <h2 class="text-white">LOGIN</h2>
                <p class="text-white-50 mt-2 mb-5">서비스를 사용하려면 로그인을 해주세요! V4.0</p>

                <div class = "mb-2">
                    <form action="/login" method="POST">
                        <input type="hidden" th:name="${_csrf?.parameterName}" th:value="${_csrf?.token}" />
                        <div class="mb-3">
                            <label class="form-label text-white">Email address</label>
                            <input type="email" class="form-control" name="username">
                        </div>
                        <div class="mb-3">
                            <label class="form-label text-white">Password</label>
                            <input type="password" class="form-control" name="password">
                        </div>
                        <button type="submit" class="btn btn-primary">Submit</button>
                    </form>

                    <button type="button" class="btn btn-secondary mt-3" onclick="location.href='/signup'">회원가입</button>
                </div>
            </div>
        </div>
    </div>
</section>
</body>
</html>
```
### 1.1 Github 토큰생성
워크플로우 에서 사용할 ACCESS TOKEN 들을 각 사이트에 방문해서 생성 합니다.
- Github Token 생성
Github 사이트에서 아래와 같이 토큰을 생성 합니다.
`Profile` → `settings` → `< > Developer settings` → `🔑 Personal access tokens` → `Fine-grained tokens` → `Generate new token`

- 상세 입력 항목
| 입력 항목 | 입력 값 |
|----------------|------------------------------|
| Token name | personal_access_token |
| Repository access  | **All repositories** 에 체크 |
| Repository Permission | **Read and Write** for Actions, Administration, Codepsaces, Contents, Metadata, Pull requests, Secrets, Variables, Workflows | 

### 1.2 Docker Hub 토큰 생성
[도커 허브 사이트](https://hub.docker.com/) 에서 아래와 같이 ACCESS TOKEN을 생성합니다.
`Profile` → `Account Setting` → `🔑 Personal access tokens` → `Generate new token`

- 상세 입력 항목
| 입력 항목 | 입력 값 |
|----------------|------------------------------|
| Access token description | Github Workflow TOKEN |
| Expiration date | 30 days |
| Access permissions | Read & Write | 

### 1.3 워크 플로우 디렉토리 생성
istory-web-k8s 디렉토리에서 수행
```bash
mkdir -p .github/workflows
```
### 1.4 create-secret.sh 작성
파일 위치 : .github/workflows/create-secret.sh
```bash
gh api -X PUT repos/<your-github-id>/istory-web-k8s/environments/k8s-dev  --silent
gh secret set DATABASE_URL --env k8s-dev --body "jdbc:mysql:istory-db-lb:3306/istory"
gh secret set MYSQL_DATABASE --env k8s-dev --body "istory"
gh secret set MYSQL_USER --env k8s-dev --body "user"
gh secret set MYSQL_PASSWORD --env k8s-dev --body "user12345"
gh secret set MYSQL_ROOT_PASSWORD --env k8s-dev --body "admin123"

gh secret set DOCKER_USERNAME --env k8s-dev --body "<your-docker-hub-id>"
gh secret set DOCKER_TOKEN --env k8s-dev --body "<your-docker-hub-token>"

gh secret set GIT_ACCESS_TOKEN --env k8s-dev --body "<your-github-access-token>"
gh secret set GIT_USERNAME --env k8s-dev --body "<your-github-id>"
gh secret set GIT_PLATFORM_REPO_NAME --env k8s-dev --body "<your-githhub-repository-name>"

gh secret set K8S_CLUSTER_NAME --env k8s-dev --body "istory"
gh secret set K8S_NAMESPACE --env k8s-dev --body "istory-dev"

gh secret set AWS_ACCESS_KEY_ID --env k8s-dev --body "<your-aws-access-key-id>"
gh secret set AWS_SECRET_ACCESS_KEY --env k8s-dev --body "<your-aws-access-key>"
gh secret set AWS_REGION --env k8s-dev --body "<your-aws-region>"
```
- 파일 권한 부여 및 실행
```bash
chmod +x .github/workflows/create-secret.sh

.github/workflows/create-secret.sh
```

## 2. Workflow 생성
### 2.1 MySQL 서비스 및 환경설정
파일 위치 : .github/workflows/istory-aws-eks-dev.yml
```yml
#8
name: Istory Deploy to AWS EKS DEV
on:
  push:
    branches: ['main', 'test']
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
          aws eks update-kubeconfig --region ${{ secrets.AWS_REGION }} --name ${{ secrets.K8S_CLUSTER_NAME }}

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
파일 위치 : .github/workflows/istory-aws-eks-dev.yml
```yml
      - name: 소스코드 다운로드
        uses: actions/checkout@v4 
        with:
          ref: ${{ github.ref }}
          path: .
  
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
        
      - name: JAVA build with TEST
        run: ./gradlew build

      - name: Docker 디렉토리로 JAR 파일 복사
        run: |
          mkdir -p xinfra/docker/build/libs/
          cp build/libs/*.jar xinfra/docker/
          ls xinfra/docker/
```
### 2.3 컨테이너 빌드 및 업로드
파일 위치 : .github/workflows/istory-aws-eks-dev.yml
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

      - name: Docker Hub 이미지 업로드
        run: |
          docker push ${{ secrets.DOCKER_USERNAME }}/istory:${{ env.DOCKER_TAG }}
          docker push ${{ secrets.DOCKER_USERNAME }}/istory:latest
```

### 2.4 이미지 태그 변경
파일 위치 : .github/workflows/istory-aws-eks-dev.yml
```yml
      - name: 서비스 리포지토리 체크아웃
        uses: actions/checkout@v4
        with:
          repository: ${{ secrets.GIT_USERNAME }}/${{ secrets.GIT_PLATFORM_REPO_NAME }}
          ref: ${{ github.ref }} # 바꾸기
          path: .
          token: ${{ secrets.GIT_ACCESS_TOKEN }}
  
      - name: 쿠버네티스 secret 생성 (istory-db-secret)
        run: |
          kubectl create secret generic istory-db-secret \
            --from-literal=MYSQL_USER=${{ secrets.MYSQL_USER }} \
            --from-literal=MYSQL_PASSWORD=${{ secrets.MYSQL_PASSWORD }} \
            --from-literal=DATABASE_URL=${{ secrets.DATABASE_URL }} \
            --from-literal=MYSQL_ROOT_PASSWORD=${{ secrets.MYSQL_ROOT_PASSWORD }} \
            --namespace=${{ secrets.K8S_NAMESPACE}} \
            --dry-run=client -o yaml | kubectl apply -f -

      - name: 이미지 태그 업데이트 (kustomize)
        run: |
          cd overlay/aws-dev
          kustomize edit set image ${{ secrets.DOCKER_USERNAME }}/istory=${{ secrets.DOCKER_USERNAME }}/istory:${{ env.DOCKER_TAG }}
      - name: 서비스 리포지토리 최종 업데이트
        run: |
          git config --global user.name 'github-actions[bot]'
          git config --global user.email 'github-actions[bot]@users.noreply.github.com'
          git commit -am "Update image tag to ${{ env.DOCKER_TAG }}"
          git push origin ${{ github.ref_name }} 
```

### 2.5 전체파일
```yml
#8
name: Istory Deploy to AWS EKS DEV
on:
  push:
    branches: [ 'main', 'test' ]
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

      - name: 소스코드 다운로드
        uses: actions/checkout@v4 
        with:
          ref: ${{ github.ref }}
          path: .
  
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
        
      - name: JAVA build with TEST
        run: ./gradlew build

      - name: Docker 디렉토리로 JAR 파일 복사
        run: |
          mkdir -p xinfra/docker/build/libs/
          cp build/libs/*.jar xinfra/docker/
          ls xinfra/docker/
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

      - name: Docker Hub 이미지 업로드
        run: |
          docker push ${{ secrets.DOCKER_USERNAME }}/istory:${{ env.DOCKER_TAG }}
          docker push ${{ secrets.DOCKER_USERNAME }}/istory:latest

      - name: 서비스 리포지토리 체크아웃
        uses: actions/checkout@v4
        with:
          repository: ${{ secrets.GIT_USERNAME }}/${{ secrets.GIT_PLATFORM_REPO_NAME }}
          ref: ${{ github.ref }} # istory-web-k8s, istory-platform 의 동일한 브렌치 라는 가정
          path: .
          token: ${{ secrets.GIT_ACCESS_TOKEN }}
  
      - name: 쿠버네티스 secret 생성 (istory-db-secret)
        run: |
          kubectl create secret generic istory-db-secret \
            --from-literal=MYSQL_USER=${{ secrets.MYSQL_USER }} \
            --from-literal=MYSQL_PASSWORD=${{ secrets.MYSQL_PASSWORD }} \
            --from-literal=DATABASE_URL=${{ secrets.DATABASE_URL }} \
            --from-literal=MYSQL_ROOT_PASSWORD=${{ secrets.MYSQL_ROOT_PASSWORD }} \
            --namespace=${{ secrets.K8S_NAMESPACE}} \
            --dry-run=client -o yaml | kubectl apply -f -

      - name: 이미지 태그 업데이트 (kustomize)
        run: |
          cd overlay/aws-dev
          kustomize edit set image ${{ secrets.DOCKER_USERNAME }}/istory=${{ secrets.DOCKER_USERNAME }}/istory:${{ env.DOCKER_TAG }}
      - name: 서비스 리포지토리 최종 업데이트
        run: |
          git config --global user.name 'github-actions[bot]'
          git config --global user.email 'github-actions[bot]@users.noreply.github.com'
          git commit -am "Update image tag to ${{ env.DOCKER_TAG }}"
          git push origin ${{ github.ref_name }} 
```

## 3. ArgoCD 확인 및 웹사이트 접속
애플리케이션 수정한것을 커밋하고 리포지토리에 업로드합니다.
### 3.1 Commit 및 Push
```bash
git add .
git commit -am "[aws-dev deploy]add workflow"
git push origin main
```
### 3.2 ArgoCD URL 조회 및 접속
URL 접속해서 Commit Hash 값을 비교해서 달라 지는지 확인 후 **Sync** 버튼을 눌러 동기화 합니다.
```bash
kubectl get svc argocd-server -n argocd
```

### 3.3 Istory URL 조회 및 접속 
Istory 서비스에 접속해서 로그인 화면의 버전이 맞는지 확인 합니다.
```bash
kubectl get svc -n istory-dev 
```

`http://<site-url>` 로 접속





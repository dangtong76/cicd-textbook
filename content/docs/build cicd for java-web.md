---
title: "4. Java 웹사이트 파이프라인 구성"
weight: 4
date: 2025-03-18
draft: false
---
## 1. Istory 로컬 개발 환경 만들기 
### 소스 클론 하기
```bash
git clone https://github.com/dangtong-s-inc/istory-app.git
cd istory-app
mkdir -p xinfra/istory-local
cd xinfra/istory-local
```

### Dockerfile 작성
파일명 : xinfra/istory-local/Dockerfile
```dockerfile
FROM eclipse-temurin:21-jdk-alpine
VOLUME /tmp
RUN addgroup -S istory && adduser -S istory -G istory
USER istory
WORKDIR /home/istory
COPY springbootdeveloper-0.0.1-SNAPSHOT.jar /home/istory/istory.jar
ENTRYPOINT ["java","-jar","/home/istory/istory.jar"]
# docker run p 8080:8080 -e JAVA_OPTIONS="--Xms1024m --Xmx1024"
```
### applicatin.yml 수정
```yml
spring:
  datasource:
    url: ${DATABASE_URL:jdbc:mysql://localhost:3306/istory}
    username: ${MYSQL_USERNAME:root}
    password: ${MYSQL_PASSWORD:admin123}
    driver-class-name: com.mysql.cj.jdbc.Driver
  jpa:
    database-platform: org.hibernate.dialect.MySQLDialect
    hibernate:
      ddl-auto: create-drop
    show-sql: true
  application:
    name: USER-SERVICE
  jwt:
    issuer: user@gmail.com
    secret_key: study-springboot
```
## 2. Istory 클라우드 환경 구성
## 3. Istory CI 파이프라인 구성
## 4. Istory CD 파이프라인 구성
## 5. Istory 부하테스트 자동화
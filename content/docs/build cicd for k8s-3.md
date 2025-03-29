---
title: "8. 쿠버네티스 배포-플랫폼 구성"
weight: 8
date: 2025-03-18
draft: false
---

## 8-1. istory-app base 생성
### istory-app-config.yml
위치 : xinfra/istory-platform/base/istory-app
```yml
apiVersion: v1
kind: ConfigMap
metadata:
  name: istory-app-config
data:
  spring.datasource.url: 'jdbc:mysql://istory-db-lb:3306/istory'
  spring.datasource.driver-class-name: 'com.mysql.cj.jdbc.Driver'
  spring.jpa.database-platform: 'org.hibernate.dialect.MySQLDialect'
  spring.jpa.hibernate.ddl-auto: 'update'
  spring.jpa.show-sql: 'true'
  spring.application.name: 'USER-SERVICE'
```
### istory-app-deploy.yml
위치 : xinfra/istory-platform/base/istory-app
```yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name:  istory-app-deploy
  labels:
    app:  istory-app
spec:
  selector:
    matchLabels:
      app: istory-app
  replicas: 3
  template:
    metadata:
      labels:
        app: istory-app
    spec:
      initContainers:
        - name: check-mysql-ready
          image: mysql:8.0
          env:
            - name: MYSQL_USER
              valueFrom:
                secretKeyRef:
                  name: istory-db-secret
                  key: MYSQL_USER
            - name: MYSQL_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: istory-db-secret
                  key: MYSQL_PASSWORD
          command: ['sh',
                    '-c',
                    'until mysqladmin ping -u ${MYSQL_USER} -p${MYSQL_PASSWORD} -h istory-db-lb; do echo waiting for database; sleep 2; done;']
      containers:
        - name: istory
          image: dangtong/istory:latest
          envFrom:
            - configMapRef:
                name: istory-app-config
          env:
            - name: spring.datasource.password
              valueFrom:
                secretKeyRef:
                  name: istory-db-secret
                  key: MYSQL_PASSWORD
            - name: spring.datasource.username
              valueFrom:
                secretKeyRef:
                  name: istory-db-secret
                  key: MYSQL_USER
          readinessProbe:
            httpGet:
              path: /
              port: 8080
            initialDelaySeconds: 60
            timeoutSeconds: 3
            successThreshold: 2
            failureThreshold: 3
            periodSeconds: 20
          ports:
            - containerPort:  3306
              name: istory
      volumes:
        - name: application-config
          configMap:
            name: istory-app-config
      restartPolicy: Always
```
### istory-app-lb.yml
위치 : xinfra/istory-platform/base/istory-app
```yml
apiVersion: v1
kind: Service
metadata:
  name: istory-app-lb
spec:
  type: LoadBalancer
  selector:
    app: istory-app
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 800
  ports:
    - name: istory-app-lb
      protocol: TCP
      port: 80
      targetPort: 8080
```
### kustomiztion.yml
위치 : xinfra/istory-platform/base/istory-app
```yml
resources:
  - istory-app-config.yml
  - istory-app-deploy.yml
  - istory-app-lb.yml
```

## 8-2. istory-db base 생성
### istory-db-lb.yml
위치 : xinfra/istory-platform/base/istory-db/
```yml
apiVersion: v1
kind: Service
metadata:
  name: istory-db-lb
spec:
  selector:
    app: mysql
  ports:
    - name: mysql-db-lb
      protocol: TCP
      port: 3306
```
### istory-db-pod.yml
위치 : xinfra/istory-platform/base/istory-db/
```yml
apiVersion: v1
kind: Pod
metadata:
  name: istory-db
  labels:
    app: mysql
spec:
  containers:
    - image: mysql/mysql-server
      name: mysql
      envFrom:
        - secretRef:
            name: istory-db-secret
      ports:
        - containerPort: 3306
          name: mysql
      volumeMounts:
        - name: mysql-persistent-storage
          mountPath: /var/lib/mysql
  volumes:
    - name: mysql-persistent-storage
      persistentVolumeClaim:
        claimName: mysql-pv-claim
```
### istory-db-pvc.yml
위치 : xinfra/istory-platform/base/istory-db
```yml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mysql-pv-claim
  labels:
    app: mysql
spec:
  storageClassName: gp2-persistent
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```
### istory-db-sc.yml
위치 : xinfra/istory-platform/base/istory-db
```yml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp2-persistent
provisioner: kubernetes.io/aws-ebs
reclaimPolicy: Retain
parameters:
  type: gp2
  fsType: ext4
volumeBindingMode: WaitForFirstConsumer
```
### kustomiztion.yml
위치 : xinfra/istory-platform/base/istory-db
```yml
resources:
  - istory-db-pod.yml
  - istory-db-lb.yml
  - istory-db-pvc.yml
  - istory-db-sc.yml
```

## 8-3. istroy-tools base 생성
### busybox.yml
위치 : xinfra/istory-platform/base/istory-tools
```yml
apiVersion: v1
kind: Pod
metadata:
  name: ubuntu-pod
spec:
  containers:
    - name: ubuntu-container
      image: ubuntu
      command: ["sleep", "infinity"]
```

### kustomization.yml
위치 : xinfra/istory-platform/base/istory-tools
```yml
resources:
  - busybox.yml
```

## 8-4. aws-dev overlay 생성
### patch-deploy.yml
```yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: istory-app-deploy
  annotations:
    istory.io/env: dev
    istory.io/tier: backend-app
    istory.io/infra: aws
spec:
  replicas: 1
```
### patch-lb-annotaions.yml
```yml
apiVersion: v1
kind: Service
metadata:
  name: istory-lb
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: external
    service.beta.kubernetes.io/aws-load-balancer-nlb-target-type: ip
    service.beta.kubernetes.io/aws-load-balancer-scheme: internet-facing
    istory.io/infra: aws
    istory.io/env: dev
    istory.io/tier: app-lb
```
### kustomization.yml


- kustomiztion.yml newTag 사용하기
```yml
resources:
  - ../../base/istory-app
  - ../../base/istory-db

namespace: istory-dev

patches:
  - path: patch-lb-annotations.yaml
    target:
      kind: Service
      name: istory-app-lb
  - path: patch-deploy.yaml
    target:
      kind: Deployment
      name: istory-app-deploy

images:
  - name: dangtong76/istory
    newTag: latest

generatorOptions:
  disableNameSuffixHash: true
```
kustomization.yml 에서 변경시에는 아래와 같이 명령어 사용
```bash
 kustomize edit set image istory=dagntong76/istory:${{ github.sha }}
```
- patch-deploy.yml 에서 사용하기기
```yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: istory-app-deploy
  annotations:
    istory.io/env: dev
    istory.io/tier: backend-app
    istory.io/infra: aws
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: istory
          image: dangtong76/istory:latest
```
이경우는 아래와 같이 workflow 에서 SED 를 사용

```bash
sed -i "s|image: .*|image: dangtong76/istory:${{ github.sha }}|" overlay/aws-dev/patch-deploy.yml
```
| 방식 | 장점 | 단점 |
|-------------------------|-----------------------|----------------------|
| kustomization + newTag | kustomize 명령어 사용 | 전체 적용 |
| istory-deploy.yml 사용 | 이미지 여러개일 경우 적용 | sed 명령 사용 | 

## 연습문제 aws-prod overlay 생성
- istory prod 요구사항
  -  AWS RDS 를 사용합니다.
  -  Replica 개수를 3로 합니다.
  -  istory.io 관련 annotion을 prod 기준으로 수정


  



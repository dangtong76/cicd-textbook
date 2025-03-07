---
title: "Appendix - 명령어 모음"
weight: 999
date: 2025-02-02
draft: false
#url: "/git-reference/"
---

1. 깃 명령어 모음

    ```bash
    # 리포지토리 초기화
    git init 

    # Stage 에 파일 추가
    git add .  

    # 커밋할때 파일추가하고 메시지까지 남기기
    git commit -am <message> 

    # 로컬 커밋들을 원격 저장소로 업로드 및 update, "원격 추적 브렌치 update" 
    git push origin main 

    # 원격 저장소 main 브렌치 내용을 "원격 추적 브렌치 fetch", "현재 브렌치 merge", "작업 디렉토리 update" 
    git pull origin main 

    # 원격 저장소 main 브렌치 내용을 "원격 추적 브렌치 fetch" 
    git fetch origin main 

    # 원격의 저장소 내용을 로컬로 업데이트 하고 그위에 로커 커밋을 추가함
    git pull --rebase 

    # 해당 커밋으로 되돌아감
    git revert <commit hash ID> 

    # 커밋 히스토리 보기
    git log 
    ```

2. gh 명령어 모음

    ```bash
    # github cli 인증
    gh auth login

    # 리포지토리 인증 및 연결 상태 황인
    gh auth status

    # 리포지토리 연결 변경 (다른 계정으로)
    gh auth switch 

    # 워크플로우 조회
    gh workflow list

    # 워크플로우 활성화
    gh workflow enable "Change Working Dir & Shell"

    # 워크플로우 비활성화
    gh workflow disable  "Change Working Dir & Shell"

    # 워크플로우 run 리스트
    gh run list

    # 실패한 run 리스트만 보기
    gh run list --status failure

    # 워크플로우 run Cancel
    gh run cancel <workflow-hash-id>

    # 워크플로우 run Delete
    gh run delete <workflow-hash-id>

    # 리포지토리 생성
    gh repo create <REPO_NAME> --public
    ```
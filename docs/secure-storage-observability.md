# 배포 후 관찰 지표

SDK의 Performance API 측정값은 브라우저 메모리에만 기록합니다. 값에는 식별자·사용자 속성·암호화 실패 상세를 넣지 않습니다. 원격 전송 기능이나 운영 대시보드를 자동 생성하지 않습니다.

## SDK load와 요청 수

`notifly.initialize.success/failure`는 유효한 초기화 시작부터 READY/실패 반환 직전까지입니다. 중복 initialize 호출은 별도 초기화 분모에 넣지 않습니다.

`notifly.storage.migrate.success/failure`와 `notifly.storage.restore.success/failure`는 원본 조회 이후 첫 이관과 기존 암호문 복원을 구분합니다. 워커 점검 시간은 전체 초기화 시간에 포함되며 저장소 하위 측정에는 포함되지 않습니다.

`notifly.user-state.<원인>.success/failure`는 논리적 조회 완료까지입니다. 원인은 initial, session, identity, sse, refresh, correction입니다. `notifly.user-state.request.success/failure`는 HTTP 시도별 응답 헤더 수신까지로, 기존 HTTP 재시도도 포함합니다. 논리적 조회와 HTTP 요청 수를 혼용하지 않습니다.

기존 RUM 수집기가 initialize 전에 PerformanceObserver를 연결하여 집계합니다. 개별 이름별 최신 measure만 유지하므로 페이지 종료 시 getEntries만 읽어서 전체 요청 수를 세면 안 됩니다. Observer에서 SDK 버전·브라우저 계열·첫 이관/복원별로 집계하고 사용자 ID나 전체 URL은 태그로 넣지 않습니다.

- SDK load P50/P95, 초기화 시도 수·성공률.
- 첫 이관과 복원 소요 시간 P50/P95.
- JS user-state 분당 실제 HTTP 요청 수, 초기화당 initial/correction 요청 수, HTTP 재시도 비율.
- 초기화 실패가 분모에서 제외되지 않았는지 확인합니다. 저장소 준비 이전 실패도 initialize.failure에는 포함합니다.

## 서버와 DB

기존 CloudWatch/API 대시보드에서 같은 시간 간격과 동일한 실행 용량을 기준으로 비교합니다.

- api-service CPUUtilization·MemoryUtilization P50/P95와 태스크별 최대값, RunningTaskCount, 요청 오류율·응답 지연.
- DB Reader의 SelectThroughput·SelectLatency, CPUUtilization, FreeableMemory, DatabaseConnections, ReadLatency. DB Load와 대기 원인은 Database Insights/Performance Insights에서 확인합니다.
- 다른 API·SSE 요청량, 배포 시각, 태스크 수 변경을 같이 표시합니다. Reader 조회량 증가만으로 병목이라고 판단하지 않습니다.

AWS/ECS 서비스 사용률은 ServiceName/ClusterName, 태스크별 자원은 ECS/ContainerInsights, Reader는 AWS/RDS의 실제 reader 인스턴스 dimension을 사용합니다. 운영 식별자는 배포 환경에서 기존 대시보드와 맞춰 설정합니다.

CPU 사용률 상승 1%p 내외를 기존 목표로 보고, p95 SDK load 악화·초기화 실패·Reader 지연/대기 증가를 함께 판단합니다. 과거 CPU 및 메모리 회귀 계수는 운영 관측의 추정치이며 요청 한 건의 실제 할당량이 아닙니다. 이번 로컬 API 지연 fixture 결과를 운영 지연이나 서버 부하 측정값으로 사용하지 않습니다.

## 배포 판단

호환 워커 활성 확인 → 소수 사이트 적용 → 초기화 성공률/지연과 user-state 증가율 확인 → 서비스·Reader 지표 확인 → 확대 순서로 진행합니다. 실패 시 새 형식을 읽는 복구 SDK를 사용합니다. 신규 형식을 읽지 못하는 구버전이나 저장소 삭제로 롤백하지 않습니다.

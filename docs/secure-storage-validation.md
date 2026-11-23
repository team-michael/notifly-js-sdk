# 로컬 검증 결과 — 2026-11-23

기준 main은 `3b3b46cf48a1a1eb0861eddc4dc2e77391a721d3`입니다. 기준 단위 테스트는 16 suites / 243 tests였습니다.

독립 리뷰 보완 후 단위 테스트 22 suites / 281 tests, TypeScript 검사, 모든 배포용 형식의 로컬 빌드를 통과했습니다. 신규 저장소 모듈 lint 오류는 없으며 기존 규칙의 non-null assertion 경고 2건이 있습니다.

Chrome·Firefox·WebKit에서 33개의 기능 시나리오와 Chrome 지연 비교 1개가 통과했습니다. 동일 벤치마크의 Firefox/WebKit 실행 2개만 의도적으로 제외했습니다.

- 신규 설치·두 탭 동시 설치·새로고침·SPA의 식별자와 요청 수.
- 실제 브라우저 프로세스 종료/재시작 후 비추출 CryptoKey 및 암호문 복원.
- 고정된 실제 구버전 SDK 번들의 writer 차단 및 ID/JWT 보존.
- 신규 classic 워커의 importScripts/활성 capability, 이관 전후 push_delivered/push_click 식별자 유지.
- 키 삭제 후 초기화 실패와 암호문 보존, 초기 user-state 실패 시 대기 이벤트 종료.
- 다른 탭의 사용자 변경 후 상태 재조회, BFCache persisted lifecycle 계약.
- 사용자 상태 평문 캐시 제거와 Performance API 단계별 기록.

독립 리뷰에서 찾은 동시 로그인/로그아웃, 이전 사용자 속성·SSE·지연 팝업 사용, 워커 경로 변경, 진행 중 upgrade의 타임아웃, 초기 복원과 서버 ID 보정 충돌, pending 워커 복구에 대해 15개 회귀 검증을 실패→수정→통과 순으로 확인했습니다.

Jest는 암호문/AAD 변조, 추가 복호화 3회, 미지원 버전, CAS 충돌, quota abort, blocked upgrade의 늦은 완료 차단, 중단 이관 재개, 오래된 user-state 응답 폐기, 이벤트 발생 시각/EIC 날짜 보존도 확인합니다.

## 지연 비교

Chrome headless, 그룹당 10회입니다. 고정된 KMP 서브모듈 `03f288c5`에서 Core 2.22.0을 다시 생성하고 선언·lockfile·실제 의존성 버전 일치를 확인한 최종 실행입니다. user-state만 50ms 지연을 둔 로컬 fixture이며 나머지 API는 즉시 응답합니다. 각 샘플은 새 브라우저 context에서 최초 초기화 후 같은 저장소로 문서를 다시 로드했습니다. SDK initialize 시작부터 반환까지 측정했습니다.

- 기존 최초 초기화: P50 68.1ms / P95 70.7ms.
- 변경 최초 초기화: P50 70.6ms / P95 75.6ms.
- 기존 재진입: P50 2.6ms / P95 3.4ms.
- 변경 재진입: P50 56.8ms / P95 58.2ms.
- 같은 20번 초기화에서 user-state는 기존 10회, 변경 20회였습니다. 이는 최초+재진입을 1:1로 만든 테스트 결과이며 실제 운영 증가율이 아닙니다.

50ms 응답을 새로 기다리는 재진입 경로의 영향을 확인한 결과입니다. 운영 네트워크·사용자별 응답 크기·서버 자원 부하·팝업 렌더링 시간은 이 수치로 추정하지 않습니다. 재현 결과 JSON은 Playwright의 initialization-timing attachment에 생성됩니다.

## 릴리스 전에 남는 검증

실제 Safari/iOS Safari 기기, 실제 기존 push subscription과 OS 알림 UI/APNs·FCM 전송, 고객사 자체 호스팅 워커의 활성 갱신, 실제 사이트 BFCache 동작, 운영 관찰 대시보드와 제한 배포 판단은 아직 수행하지 않았습니다. 테스트는 네트워크와 푸시 전달을 fixture로 대체합니다.

이 변경에는 워커의 기존 사용자 ID 해시 구현이 유지됩니다. 페이지 UUID v5와 워커의 기존 자체 해시 구현 차이는 저장소 이관에서 임의로 바꾸지 않았으며 별도 검토가 필요합니다.

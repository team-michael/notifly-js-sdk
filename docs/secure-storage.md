# JS SDK 저장소 보안 개선

브랜치: `codex/js-secure-storage`. 공개 API와 사용자 ID 계산은 유지합니다. SDK/워커 운영 배포는 별도 단계입니다.

## 저장 구조

`notifly` IndexedDB의 `notiflyprotected`에 비추출 AES-256-GCM CryptoKey와 암호문을 저장합니다. 암호문 안에는 projectId, deviceId, externalUserId, username, password의 **이름과 값**이 함께 들어갑니다. 매번 새로운 12바이트 IV와 128비트 인증 태그를 사용합니다.

schemaVersion, cryptoVersion, keyVersion, revision은 SDK 버전과 별개이며, 모두 인증된 추가 데이터(AAD)에 포함합니다. 현재 각 형식 버전은 1입니다. revision은 쓰기마다 증가하며 다른 탭의 변경을 덮어쓰는 것을 차단합니다.

JWT·세션 시각·푸시 권한·워커 버전은 `notiflyconfig-v2`에 기존 값과 형식으로 보존합니다. JWT 인증·갱신 정책은 변경하지 않습니다.

사용자 속성·캠페인·EIC·로컬 노출 제한은 메모리에만 둡니다. `__notiflyState` 읽기/쓰기를 제거하고 이관 시 기존 값도 삭제합니다. 서버에 아직 반영되지 않은 값은 새로고침 후 사라질 수 있습니다.

같은 출처에서 실행 권한을 가진 스크립트는 CryptoKey를 이용해 복호화할 수 있습니다. 이 변경은 평문 저장과 키 원문 추출을 줄이는 조치이며, XSS 또는 브라우저 프로필 전체 탈취를 차단하는 별도 보안 경계는 아닙니다.

## 이관과 실패 처리

1. 공개 SDK 설정을 읽고, 기존 활성 Notifly 워커의 저장 형식 지원을 확인합니다.
2. 기존 식별자를 읽어 암호화 후보를 만듭니다. 기존 식별자가 일부만 남았거나 프로젝트가 다르면 중단합니다.
3. IndexedDB versionchange 트랜잭션에서 원본이 바뀌지 않았는지 확인합니다. `notiflyconfig`를 `notiflyconfig-v2`로 이름 변경하고 키/암호문을 pending으로 저장합니다. JWT와 비민감 설정을 삭제하지 않습니다.
4. 저장된 키와 암호문을 다시 읽고 복호화합니다. 같은 revision인지 확인한 뒤 보호 항목 평문과 상태 캐시를 삭제하고 ready로 확정합니다. 이 마지막 단계는 하나의 트랜잭션입니다.
5. 중단된 pending 이관은 다음 문서 초기화에서 재개합니다. 호환 워커도 pending 암호문을 검증한 뒤 같은 확정 트랜잭션으로 복구할 수 있습니다. 새 형식이 있으면 남은 legacy ID로 돌아가지 않습니다.

옛 store 이름을 제거해야 구버전 SDK가 평문을 재생성하지 못합니다. 따라서 이관 후 열려 있는 구버전 탭의 SDK 작업은 실패할 수 있으며 새 SDK로 다시 로드해야 합니다. 구버전 연결이 업그레이드를 막으면 1초 후 이관을 보류합니다. 연결이 뒤늦게 닫혀도 이미 실패한 업그레이드는 abort합니다.

IDB 열기/트랜잭션과 개별 WebCrypto 연산에는 각각 1초 제한을 적용합니다. 취소할 수 없는 늦은 암호화 결과는 종료된 Promise 이후 저장 단계로 전달하지 않습니다. 복호화 오류는 최초 1회와 추가 3회까지 시도합니다. 키 유실·미지원 버전·API 미지원·타임아웃은 별도로 실패 처리합니다.

어떤 실패에서도 자동 키 교체, 새 deviceId 발급, 평문 fallback, 평문 롤백 사본을 만들지 않습니다. 오류 상세는 로컬 콘솔에만 남습니다. 초기화는 false를 반환하고 대기 명령도 종료합니다. 고객 사이트 전체를 중단하거나 강제 새로고침하지 않습니다.

## 초기화와 사용자 전환

새 문서에서 `initialize`를 호출하면 저장소 준비 → 기존 인증 준비 → user-state → 기존 세션/푸시 준비 → READY 순으로 진행합니다. 정상 초기 조회는 1회이며, 서버 사용자 매핑 보정이나 기존 HTTP 재시도는 별도 요청입니다. 초기화 진행 중 재호출은 기존 정책대로 false, 준비 후 재호출은 true입니다.

SPA 경로 이동은 새 문서 초기화가 아니므로 추가 조회를 만들지 않습니다. BFCache의 persisted pagehide로 SDK를 종료하지 않으며, 복귀 시 식별자/세션 변경을 확인합니다.

초기화 중 이벤트는 기존 명령 큐에 보관합니다. 이벤트 인자와 발생 시각을 접수 시점에 복사하여 전송 시각과 EIC 날짜에 사용합니다. SDK load 완료는 READY와 initialize 반환까지이며, 대기 이벤트 전체 처리나 팝업 표시 완료를 뜻하지 않습니다.

사용자 상태 응답은 요청 시작 시 식별자 revision과 현재 revision이 같은 경우에만 반영합니다. 다른 탭의 로그인/로그아웃은 이벤트 및 포커스 복귀 경계에서 감지하고 이전 상태를 버린 뒤 재동기화합니다. 탭 간 변경이 계속되면 제한된 보정 조회 후 실패합니다.

```ts
const ready = await notifly.initialize({ projectId, username, password });
if (ready) {
    await notifly.trackEvent('page_view', { page_path: location.pathname });
}
```

지원 환경은 HTTPS secure context, IndexedDB, WebCrypto AES-GCM, CryptoKey의 IndexedDB 저장/복원을 실제로 지원해야 합니다. UA 문자열만으로 지원 여부를 확정하지 않습니다.

## 서비스 워커 및 배포 순서

워커는 classic 단일 파일이며 기존 importScripts 경로를 유지합니다. v1.5.0은 legacy와 신규 저장 형식을 모두 읽고, 활성 워커가 capability 메시지로 schema/crypto 지원을 응답합니다. 버전 문자열이나 CDN 업로드만으로 이관을 허용하지 않습니다. 신규 SDK가 워커를 강제로 등록하거나 권한을 요구하지 않습니다.

SDK와 KMP Core의 출시 버전을 함께 확정·빌드한 뒤, 호환 워커 선행 배포·활성 확인 → 제한된 사이트에서 SDK 적용 → 초기화/푸시/자원 지표 관찰 → 확대 순서로 진행합니다. 자체 호스팅 워커는 해당 파일을 먼저 갱신해야 합니다. 기존 구독과 권한을 삭제하지 않습니다. 과거 워커 사용 기록이 있는데 현재 설정과 다른 경로에 푸시 구독이 남아 있으면 해당 활성 워커도 확인합니다. 소유자를 확정할 수 없는 기존 푸시 워커가 응답하지 않으면 이관을 보류합니다.

구 SDK로 단순 다운그레이드하면 이름이 바뀐 저장소를 읽지 못합니다. 복구 릴리스는 현재 형식과 워커를 그대로 읽을 수 있어야 하며 메모리 상태 정책도 유지합니다. ID 변경·다른 사용자 상태 혼입·푸시 회귀·초기화 실패 증가가 확인되면 확대를 중단하고 호환 복구 버전으로 전환합니다. 데이터베이스 삭제로 복구하지 않습니다.

## 검증 재현

```sh
git submodule update --init --recursive
npm run build:kmp-core
npm ci --ignore-scripts
npm run type-check
npm test -- --runInBand
npm run build
npx playwright install firefox webkit
npm run test:browser
```

Chrome은 설치된 Chrome을 사용합니다. npm test:browser의 사전 단계에서 고정된 baseline 커밋 `3b3b46c`를 실제 빌드합니다. 로컬 KMP 패키지 준비는 저장소의 기존 build:kmp-core 절차를 따릅니다. 테스트 API 응답은 fixture이며 워커의 외부 fetch도 테스트 transport로 대체합니다.

자동화는 실제 엔진의 CryptoKey 영속 복원을 확인하지만 실제 APNs/FCM 전달, OS 알림 UI 및 iOS Safari 기기 검증을 대체하지 않습니다. BFCache 테스트는 persisted lifecycle을 주입하는 계약 검증입니다. 실제 사이트 탐색 시 BFCache 사용 가능 여부는 별도 릴리스 검증 대상입니다.

운영 publish/prepublishOnly/deploy:sw와 인위 부하 테스트는 이 구현 검증에서 실행하지 않습니다.

// 오프라인 캐싱 없이 PWA 설치 요건(서비스워커 등록)만 충족하는 최소 서비스워커.
// 데이터가 계속 바뀌는 사이트라 응답을 캐싱하지 않고 항상 네트워크로 통과시킨다.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {});

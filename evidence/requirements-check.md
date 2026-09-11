# 과제 3 조건별 검수

제공된 과제 원문에 있는 31개 항목을 대조했습니다. 원문은 C01 다음이 C03이며 **C02가 제시되지 않았으므로 새 기준을 만들어 넣지 않았습니다.**

검사일: 2026-09-11. 프로그램 검사는 최종 소스에서 실제 실행했고, 공개 접속은 배포 후 별도로 확인합니다.

| 기준 | 요구사항 | 결과 | 증거 |
|---|---|---|---|
| T03-C01 | 무로그인 공개 결과물/소스 URL | 배포 후 확인 | [공개 접속 확인](public-verification.json) |
| T03-C03 | 첫 화면에 이미지·문구 편집 도구 | PASS | [실행 기록](test-results.json) |
| T03-C04 | PNG 불러오기 | PASS | [실행 기록](test-results.json) |
| T03-C05 | JPEG 불러오기 | PASS | [실행 기록](test-results.json) |
| T03-C06 | 문구 위치 즉시 반영 | PASS | [실행 기록](test-results.json) |
| T03-C07 | 문구 크기 즉시 반영 | PASS | [실행 기록](test-results.json) |
| T03-C08 | 문구 색 즉시 반영 | PASS | [실행 기록](test-results.json) |
| T03-C09 | 지원하지 않는 파일 뒤 기존 작업 유지 | PASS | [실행 기록](test-results.json) |
| T03-C10 | 지원하지 않는 파일 거부 이유 | PASS | [실행 기록](test-results.json) |
| T03-C11 | 1:1 미리보기/저장 일치 | PASS | [실행 기록](test-results.json) |
| T03-C12 | 4:5 미리보기/저장 일치 | PASS | [실행 기록](test-results.json) |
| T03-C13 | 9:16 미리보기/저장 일치 | PASS | [실행 기록](test-results.json) |
| T03-C14 | 극단 입력 검사 12건 | PASS | [극단 입력 및 전후 증거](extreme-input-tests.md) |
| T03-C15 | 동일 입력 수정 전 FAIL/수정 후 PASS | PASS | [극단 입력 및 전후 증거](extreme-input-tests.md) |
| T03-C16 | 잘못된 극단 입력 뒤 편집 유지 | PASS | [극단 입력 및 전후 증거](extreme-input-tests.md) |
| T03-C17 | 템플릿 3개 이상 생성 | PASS | [실행 기록](test-results.json) |
| T03-C18 | 템플릿 불러오기 | PASS | [실행 기록](test-results.json) |
| T03-C19 | 템플릿 수정 | PASS | [실행 기록](test-results.json) |
| T03-C20 | 템플릿 삭제 | PASS | [실행 기록](test-results.json) |
| T03-C21 | 새로고침 뒤 변경 유지 | PASS | [실행 기록](test-results.json) |
| T03-C22 | 정상 JSON 복원 | PASS | [실행 기록](test-results.json) |
| T03-C23 | 손상 JSON 거부/기존 유지 | PASS | [실행 기록](test-results.json) |
| T03-C24 | 필수 누락 JSON 거부/기존 유지 | PASS | [실행 기록](test-results.json) |
| T03-C25 | 서로 다른 완성 이미지 3개 | PASS | [완성본 기록](completed-images-record.md) |
| T03-C26 | 완성 이미지 정상 열림 | PASS | [완성본 기록](completed-images-record.md) |
| T03-C27 | 완성 이미지별 제작/사용 권한 기록 | PASS | [완성본 기록](completed-images-record.md) |
| T03-C28 | 위치 메타데이터 0건 | PASS | [안전 점검](safety-audit.json) / [범위](../submission/privacy-and-safety-check.md) |
| T03-C29 | 공개 화면/제출물 개인정보 0건 | PASS | [안전 점검](safety-audit.json) / [범위](../submission/privacy-and-safety-check.md) |
| T03-C30 | 공개 파일/제출물 비밀값 원문 0건 | PASS | [안전 점검](safety-audit.json) / [범위](../submission/privacy-and-safety-check.md) |
| T03-C31 | 확인 방법 4항목 | PASS | [확인 방법 4줄](../submission/short-verification.md) |
| T03-C32 | AI와 학생 판단 3항목 | PASS | [AI와 나의 판단 3줄](../submission/ai-and-my-judgment.md) |

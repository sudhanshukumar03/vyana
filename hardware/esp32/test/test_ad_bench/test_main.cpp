#include <unity.h>
#include "../../src/bench/ADBenchBuffer.h"

void setUp() {}
void tearDown() {}

void empty_has_no_fabricated_samples() {
  ADBenchBuffer<4> ring; ADBenchSample samples[4];
  auto batch = ring.copyAfter(0, samples, 4);
  TEST_ASSERT_EQUAL(0, batch.count); TEST_ASSERT_EQUAL(0, batch.cursor);
}
void pagination_preserves_exact_samples_without_duplicates() {
  ADBenchBuffer<4> ring; ADBenchSample samples[4];
  ring.append(4, 100, 0, 1); ring.append(8, 200, 1, 0); ring.append(12, 300, 0, 0);
  auto first = ring.copyAfter(0, samples, 2);
  TEST_ASSERT_EQUAL(2, first.count); TEST_ASSERT_EQUAL(2, first.cursor);
  TEST_ASSERT_EQUAL(4, samples[0].uptime); TEST_ASSERT_EQUAL(100, samples[0].raw);
  TEST_ASSERT_EQUAL(1, samples[0].loMinus); TEST_ASSERT_EQUAL(1, samples[1].loPlus);
  auto second = ring.copyAfter(first.cursor, samples, 2);
  TEST_ASSERT_EQUAL(1, second.count); TEST_ASSERT_EQUAL(3, samples[0].sequence);
  TEST_ASSERT_EQUAL(300, samples[0].raw);
  TEST_ASSERT_EQUAL(0, ring.copyAfter(second.cursor, samples, 2).count);
}
void overflow_reports_loss_instead_of_joining_missing_samples() {
  ADBenchBuffer<4> ring; ADBenchSample samples[4];
  for (uint16_t i=1;i<=7;++i) ring.append(i*4,i*100,0,0);
  auto batch = ring.copyAfter(1,samples,4);
  TEST_ASSERT_EQUAL(2,batch.missed); TEST_ASSERT_EQUAL(4,batch.count);
  TEST_ASSERT_EQUAL(4,samples[0].sequence); TEST_ASSERT_EQUAL(7,samples[3].sequence);
}
void stale_cursor_requests_reset_after_restart() {
  ADBenchBuffer<4> ring; ADBenchSample samples[4];
  ring.append(4, 1600, 0, 0);
  auto batch=ring.copyAfter(99,samples,4);
  TEST_ASSERT_TRUE(batch.reset); TEST_ASSERT_EQUAL(1,batch.count);
  TEST_ASSERT_EQUAL(1,batch.cursor); TEST_ASSERT_EQUAL(0,batch.missed);
}
int main(int,char**) {
  UNITY_BEGIN();
  RUN_TEST(empty_has_no_fabricated_samples);
  RUN_TEST(pagination_preserves_exact_samples_without_duplicates);
  RUN_TEST(overflow_reports_loss_instead_of_joining_missing_samples);
  RUN_TEST(stale_cursor_requests_reset_after_restart);
  return UNITY_END();
}

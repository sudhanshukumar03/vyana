#include <unity.h>
#include "../../src/DeliveryPolicy.h"
void setUp() {}
void tearDown() {}
void success_codes() {
  TEST_ASSERT_TRUE(deliveryAccepted(200)); TEST_ASSERT_TRUE(deliveryAccepted(204));
  TEST_ASSERT_FALSE(deliveryAccepted(400)); TEST_ASSERT_FALSE(deliveryAccepted(500));
}
void retries() {
  TEST_ASSERT_TRUE(deliveryRetryable(-1)); TEST_ASSERT_TRUE(deliveryRetryable(429));
  TEST_ASSERT_TRUE(deliveryRetryable(500)); TEST_ASSERT_FALSE(deliveryRetryable(401));
  TEST_ASSERT_EQUAL(30000,retryDelay(0,30));
}
void bounded_queue() {
  RingQueue<int,2> queue;
  TEST_ASSERT_TRUE(queue.push(1)); TEST_ASSERT_TRUE(queue.push(2)); TEST_ASSERT_FALSE(queue.push(3));
  TEST_ASSERT_EQUAL(1,queue.front());queue.pop();TEST_ASSERT_EQUAL(2,queue.front());
  TEST_ASSERT_EQUAL(1,queue.dropped);TEST_ASSERT_EQUAL(1,queue.size());
}
void retry_after_rejects_malformed_and_bounds_large_values() {
  TEST_ASSERT_EQUAL(30, boundedRetryAfter("30"));
  TEST_ASSERT_EQUAL(12, boundedRetryAfter(" \t12\t "));
  TEST_ASSERT_EQUAL(300, boundedRetryAfter("9999999999999999999999999"));
  TEST_ASSERT_EQUAL(0, boundedRetryAfter("-1"));
  TEST_ASSERT_EQUAL(0, boundedRetryAfter("30 seconds"));
  TEST_ASSERT_EQUAL(0, boundedRetryAfter(""));
  TEST_ASSERT_EQUAL(0, boundedRetryAfter(nullptr));
}
void retry_window_handles_rollover_and_request_completion() {
  RetryWindow retry;
  TEST_ASSERT_TRUE(retry.ready(0));
  retry.start(UINT32_MAX - 99, 200);
  TEST_ASSERT_FALSE(retry.ready(99)); TEST_ASSERT_TRUE(retry.ready(100));
  retry.start(5000, 1000); // A request that started at zero finished at 5 s.
  TEST_ASSERT_FALSE(retry.ready(5999)); TEST_ASSERT_TRUE(retry.ready(6000));
}
void retry_window_does_not_stall_after_weeks_offline() {
  RetryWindow retry;
  TEST_ASSERT_TRUE(retry.ready(25U * 86400000U));
  retry.start(1000, 300000);
  TEST_ASSERT_TRUE(retry.ready(25U * 86400000U));
}
int main(int, char**) { UNITY_BEGIN();RUN_TEST(success_codes);RUN_TEST(retries);RUN_TEST(bounded_queue);RUN_TEST(retry_after_rejects_malformed_and_bounds_large_values);RUN_TEST(retry_window_handles_rollover_and_request_completion);RUN_TEST(retry_window_does_not_stall_after_weeks_offline);return UNITY_END(); }

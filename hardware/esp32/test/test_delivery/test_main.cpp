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
int main(int, char**) { UNITY_BEGIN();RUN_TEST(success_codes);RUN_TEST(retries);RUN_TEST(bounded_queue);return UNITY_END(); }

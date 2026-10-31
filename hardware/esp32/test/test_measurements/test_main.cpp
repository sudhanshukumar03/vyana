#include <unity.h>
#include "../../src/MeasurementPolicy.h"
#include "../../src/BenchClock.h"

void setUp() {}
void tearDown() {}
void optical_invalid_or_stale_is_unavailable() {
  TEST_ASSERT_TRUE(opticalUsable(true, 72, true, 98, true, 2500));
  TEST_ASSERT_FALSE(opticalUsable(false, 72, true, 98, true, 0));
  TEST_ASSERT_FALSE(opticalUsable(true, 72, false, 98, true, 0));
  TEST_ASSERT_FALSE(opticalUsable(true, 72, true, 98, false, 0));
  TEST_ASSERT_FALSE(opticalUsable(true, 72, true, 98, true, 2501));
  TEST_ASSERT_FALSE(opticalUsable(true, -999, true, 98, true, 0));
  TEST_ASSERT_FALSE(opticalUsable(true, 301, true, 98, true, 0));
  TEST_ASSERT_FALSE(opticalUsable(true, 72, true, 101, true, 0));
  // A low but algorithm-valid measurement must not be replaced with normal.
  TEST_ASSERT_TRUE(opticalUsable(true, 165, true, 88, true, 0));
}
void temperature_missing_startup_and_stale() {
  TEST_ASSERT_TRUE(temperatureUsable(36.7f, true, 2500));
  TEST_ASSERT_FALSE(temperatureUsable(36.7f, false, 0));
  TEST_ASSERT_FALSE(temperatureUsable(NAN, true, 0));
  TEST_ASSERT_FALSE(temperatureUsable(-127, true, 0));
  TEST_ASSERT_FALSE(temperatureUsable(85, true, 0));
  TEST_ASSERT_FALSE(temperatureUsable(36.7f, true, 2501));
  TEST_ASSERT_TRUE(temperatureUsable(40, true, 0));
}
void connected_leads_do_not_classify_rhythm() {
  TEST_ASSERT_EQUAL_STRING("Leads Off", ecgLeadStatus(true));
  TEST_ASSERT_EQUAL_STRING("Unknown", ecgLeadStatus(false));
}
void api_clock_parses_utc_and_rejects_invalid_dates() {
  TEST_ASSERT_TRUE(httpDateEpoch("Mon, 01 Jan 2024 00:00:00 GMT") == 1704067200LL);
  TEST_ASSERT_TRUE(httpDateEpoch("Thu, 29 Feb 2024 00:00:00 GMT") == 1709164800LL);
  TEST_ASSERT_TRUE(httpDateEpoch("Wed, 29 Feb 2023 00:00:00 GMT") == 0);
  TEST_ASSERT_TRUE(httpDateEpoch("Mon, 01 Jan 2024 24:00:00 GMT") == 0);
  TEST_ASSERT_TRUE(httpDateEpoch("Mon, 01 Jan 2024 00:60:00 GMT") == 0);
  TEST_ASSERT_TRUE(httpDateEpoch("Mon, 01 Jan 2024 00:00:60 GMT") == 0);
  TEST_ASSERT_TRUE(httpDateEpoch("Tue, 01 Jan 2024 00:00:00 GMT") == 0);
  TEST_ASSERT_TRUE(httpDateEpoch("Mon, 01 Jan 2024 00:00:00 UTC") == 0);
  TEST_ASSERT_TRUE(httpDateEpoch("Mon, 01 Jan 2024 00:00:00 GMT junk") == 0);
  TEST_ASSERT_TRUE(httpDateEpoch("Mon, 00 Jan 2024 00:00:00 GMT") == 0);
  TEST_ASSERT_TRUE(httpDateEpoch("Mon, 01 Foo 2024 00:00:00 GMT") == 0);
  TEST_ASSERT_TRUE(httpDateEpoch(nullptr) == 0);
}
void api_clock_requires_opt_in_success_and_an_unset_clock() {
  TEST_ASSERT_TRUE(benchClockBootstrapAllowed(true,true,"http://bench/api/v1/device/status",200,0));
  TEST_ASSERT_FALSE(benchClockBootstrapAllowed(false,true,"http://bench",200,0));
  TEST_ASSERT_FALSE(benchClockBootstrapAllowed(true,false,"http://bench",200,0));
  TEST_ASSERT_FALSE(benchClockBootstrapAllowed(true,true,"https://bench",200,0));
  TEST_ASSERT_FALSE(benchClockBootstrapAllowed(true,true,"http://bench",401,0));
  TEST_ASSERT_FALSE(benchClockBootstrapAllowed(true,true,"http://bench",500,0));
  TEST_ASSERT_FALSE(benchClockBootstrapAllowed(true,true,"http://bench",200,1704067200));
}
int main(int, char**) {
  UNITY_BEGIN();
   
   
   RUN_TEST(optical_invalid_or_stale_is_unavailable);
  RUN_TEST(temperature_missing_startup_and_stale); RUN_TEST(connected_leads_do_not_classify_rhythm);
  RUN_TEST(api_clock_parses_utc_and_rejects_invalid_dates);
  RUN_TEST(api_clock_requires_opt_in_success_and_an_unset_clock);
  return UNITY_END();
}

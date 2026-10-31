#pragma once
#include <stdint.h>
#include <string.h>

// Parse the configured API's IMF-fixdate Date header as UTC, independent of TZ.
// This is a clock bootstrap for an explicitly opted-in, trusted local bench.
inline int64_t httpDateEpoch(const char* value) {
  if (!value || strlen(value) != 29 || value[3] != ',' || value[4] != ' ' ||
      value[7] != ' ' || value[11] != ' ' || value[16] != ' ' ||
      value[19] != ':' || value[22] != ':' || strcmp(value + 25, " GMT")) return 0;
  const unsigned positions[] = {5,6,12,13,14,15,17,18,20,21,23,24};
  for (unsigned position : positions)
    if (value[position] < '0' || value[position] > '9') return 0;
  const char* months[] = {"Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"};
  const char* weekdays[] = {"Sun","Mon","Tue","Wed","Thu","Fri","Sat"};
  unsigned month = 0, weekday = 7;
  for (unsigned i = 0; i < 12; ++i) if (!strncmp(value + 8, months[i], 3)) month = i + 1;
  for (unsigned i = 0; i < 7; ++i) if (!strncmp(value, weekdays[i], 3)) weekday = i;
  const unsigned day = (value[5]-'0')*10 + value[6]-'0';
  const unsigned year = (value[12]-'0')*1000 + (value[13]-'0')*100 + (value[14]-'0')*10 + value[15]-'0';
  const unsigned hour = (value[17]-'0')*10 + value[18]-'0';
  const unsigned minute = (value[20]-'0')*10 + value[21]-'0';
  const unsigned second = (value[23]-'0')*10 + value[24]-'0';
  if (!month || weekday == 7 || year < 2024 || year > 2099 || hour > 23 || minute > 59 || second > 59) return 0;
  const auto leap = [](unsigned y) { return y%4 == 0 && (y%100 != 0 || y%400 == 0); };
  const unsigned lengths[] = {31,28,31,30,31,30,31,31,30,31,30,31};
  if (!day || day > lengths[month-1] + unsigned(month == 2 && leap(year))) return 0;
  int64_t days = day - 1;
  for (unsigned y = 1970; y < year; ++y) days += 365 + unsigned(leap(y));
  for (unsigned m = 1; m < month; ++m) days += lengths[m-1] + unsigned(m == 2 && leap(year));
  if (unsigned((days + 4)%7) != weekday) return 0;
  return days*86400 + hour*3600 + minute*60 + second;
}

inline bool benchClockBootstrapAllowed(bool enabled, bool insecureHttpAllowed,
                                      const char* url, int status, int64_t currentEpoch) {
  return enabled && insecureHttpAllowed && url && !strncmp(url,"http://",7) &&
         status >= 200 && status < 300 && currentEpoch <= 1700000000;
}

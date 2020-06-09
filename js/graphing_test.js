
function testIsoDateToUnixTime() {
  assertEquals(1577836800000,
               Graphing.isoDateToUnixTime('2020-01-01'),
               'Date conversion');
}

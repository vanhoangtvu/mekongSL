async function test() {
  const res = await fetch('http://localhost:3004/api/mysql?source=ecowitt&date=2026-05-31');
  const text = await res.text();
  console.log(text.substring(0, 500));
}
test();

import { UNKNOWN_CLIENT_IP, clientIpKey } from './client-ip';

describe('clientIpKey', () => {
  it.each([
    ['203.0.113.7', '203.0.113.7'],
    ['::ffff:203.0.113.7', '203.0.113.7'],
    ['::FFFF:203.0.113.7', '203.0.113.7'],
    ['::ffff:cb00:7107', '203.0.113.7'],
    ['0:0:0:0:0:ffff:203.0.113.7', '203.0.113.7'],
  ])('keeps an IPv4 address, mapped or not: %s', (ip, key) => {
    expect(clientIpKey(ip)).toBe(key);
  });

  it.each([
    ['2001:db8:0:1:aaaa:bbbb:cccc:dddd', '2001:db8:0:1::/64'],
    ['2001:0DB8:0000:0001::1', '2001:db8:0:1::/64'],
    ['2001:db8::1', '2001:db8:0:0::/64'],
    ['::1', '0:0:0:0::/64'],
    ['fe80::1%eth0', 'fe80:0:0:0::/64'],
    ['64:ff9b::203.0.113.7', '64:ff9b:0:0::/64'],
  ])('reduces another IPv6 address to its /64: %s', (ip, key) => {
    expect(clientIpKey(ip)).toBe(key);
  });

  it('gives the same key to every host of a /64', () => {
    expect(clientIpKey('2001:db8:0:1::a')).toBe(clientIpKey('2001:db8:0:1:ffff::b'));
    expect(clientIpKey('2001:db8:0:1::a')).not.toBe(clientIpKey('2001:db8:0:2::a'));
  });

  it.each([undefined, '', 'not-an-ip', '999.1.1.1', '1.2.3.4:5678'])(
    'answers the shared unknown key for %p',
    (ip) => {
      expect(clientIpKey(ip)).toBe(UNKNOWN_CLIENT_IP);
    },
  );
});

import { describe, expect, it } from 'vitest';
import { buildCards, renderCards } from './moments-content.mjs';

describe('Moments preparation safety', () => {
  it('keeps missing scores unavailable rather than inventing a neutral value', () => {
    const cards=buildCards({date:'2026-09-05',responses:{}});
    expect(cards).toHaveLength(9);
    expect(cards[1].kicker).toBe('—');
    expect(cards[5].lines).toContain('暂无可用更新');
  });
  it('escapes untrusted news markup in rendered cards', () => {
    const html=renderCards([{title:'<script>alert(1)</script>',kicker:'test',lines:['<img src=x onerror=alert(1)>'],source:'source'}],'2026-09-05');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;img');
  });
  it('uses the Chinese published report without fabricating translations', () => {
    const cards=buildCards({date:'2026-09-05',responses:{'market-insight':{body:{insight:{brief:'English only',reportDate:'2026-09-04'}}}}});
    expect(cards[0].lines[1]).toContain('中文洞察暂不可用');
    expect(cards[0].source).toContain('2026-09-04');
  });
});

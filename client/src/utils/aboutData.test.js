import { ABOUT_STEPS, ABOUT_FAQS, filterFaqsByQuery } from './aboutData.js';

describe('aboutData utilities', () => {
  test('ABOUT_STEPS contains 4 valid guided steps', () => {
    expect(Array.isArray(ABOUT_STEPS)).toBe(true);
    expect(ABOUT_STEPS.length).toBe(4);
    expect(ABOUT_STEPS[0]).toHaveProperty('id');
    expect(ABOUT_STEPS[0]).toHaveProperty('title');
  });

  test('ABOUT_FAQS contains valid questions and answers', () => {
    expect(Array.isArray(ABOUT_FAQS)).toBe(true);
    expect(ABOUT_FAQS.length).toBeGreaterThan(0);
    expect(ABOUT_FAQS[0]).toHaveProperty('q');
    expect(ABOUT_FAQS[0]).toHaveProperty('a');
  });

  test('filterFaqsByQuery filters FAQ items correctly', () => {
    const matched = filterFaqsByQuery(ABOUT_FAQS, 'free');
    expect(matched.length).toBeGreaterThan(0);
    expect(matched[0].q).toContain('free');
  });
});

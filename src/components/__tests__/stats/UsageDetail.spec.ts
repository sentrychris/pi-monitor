import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import UsageDetail from "../../stats/UsageDetail.vue";

describe("UsageDetail", () => {
  const testProps = {
    detail: {
      used: 50,
      free: 50,
      total: 100,
      percent: 50,
    },
  };

  const getWrapper = () =>
    mount(UsageDetail, {
      props: testProps,
    });

  it("renders properly", () => {
    const testHtml =
      `<p class="small"><strong>Used</strong> ${testProps.detail.used} GB</p>\n` +
      `<p class="small"><strong>Free</strong> ${testProps.detail.free} GB</p>\n` +
      `<p class="small"><strong>Total</strong> ${testProps.detail.total} GB</p>`;

    const testSubject = getWrapper();

    expect(testSubject.exists()).toBeTruthy();
    expect(testSubject.props()).toEqual(testProps);
    expect(testSubject.html()).toEqual(testHtml);
  });
});

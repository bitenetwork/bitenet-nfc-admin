import { wrappError } from "../core/error";

export const ACCOUNT_OR_PASSWORD_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "member:AccountOrPasswordIncorrect",
});

export const SIGN_UP_CAPTCHA_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "member:signUpCaptchaIncorrect",
});

export const SIGN_IN_CAPTCHA_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "member:signInCaptchaIncorrect",
});

export const PHONE_HAD_BOUND = wrappError({
  code: "PRECONDITION_FAILED",
  message: "member:phoneHadBound",
});

export const PHONE_NOT_REGISTER = wrappError({
  code: "PRECONDITION_FAILED",
  message: "member:phoneNotRegister",
});

export const MEMBER_NOT_EXIST = wrappError({
  code: "PRECONDITION_FAILED",
  message: "member:memberNotExist",
});

export const MODIFY_PASSWORD_CAPTCHA_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "member:modifyPasswordIncorrect",
});

export const FORGOT_PASSWORD_CAPTCHA_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "member:forgotPasswordIncorrect",
});

export const LUCKY_DRAW_NOT_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "member:luckyDrawNotExistsIncorrect",
});

export const CLOCK_IN_NOT_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "member:clockInNotExistsIncorrect",
});

export const LUCKY_DRAW_PARTICIPATE_IN_ERROR = wrappError({
  code: "PRECONDITION_FAILED",
  message: "member:luckyDrawParticipateInError",
});

export const LUCKY_DRAW_DATE_RANGE_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "member:luckyDrawDateRangeError",
});

export const GIFT_NOT_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "member:giftNotExistsIncorrect",
});

export const BRAND_NOT_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "member:brandNotExistsIncorrect",
});

export const RESTAURANT_NOT_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "member:restaurantNotExistsIncorrect",
});

export const REGION_NOT_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "member:regionNotExistsIncorrect",
});

export const LUCKY_DRAW_GIFT_NOT_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "member:luckyDrawGiftNotExistsIncorrect",
});

export const CLOCK_IN_GIFT_NOT_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "member:clockInGiftNotExistsIncorrect",
});

export const SIGN_IN_INTERVEL = wrappError({
  code: "PRECONDITION_FAILED",
  message: "member:signInIntervel",
});

export const DISTANCE_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "member:disTanceIncorrect",
});

export const ACCOUNT_FREEZED = wrappError({
  code: "PRECONDITION_FAILED",
  message: "member:accountFreezed",
});

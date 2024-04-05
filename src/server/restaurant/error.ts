import { wrappError } from "../core/error";

// ----------------------------------------------------------------------

export const ACCOUNT_NOT_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "restaurant:accountNotExistsIncorrect",
});

export const PASSWORD_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "restaurant:passwordIncorrect",
});

export const ACCOUNT_DISABLED_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "restaurant:accountDisabledIncorrect",
});

export const ACCOUNT_EXPIRED_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "restaurant:brandAccountExpiredIncorrect",
});

export const SIGN_IN_CAPTCHA_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "restaurant:signInCaptchaIncorrect",
});

export const FORGOT_PASSWORD_CAPTCHA_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "restaurant:forgotPasswordCaptchaIncorrect",
});

// ----------------------------------------------------------------------

export const USER_NOT_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "restaurant:userNotExistsIncorrect",
});

export const USER_PHONE_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "restaurant:userPhoneExistsIncorrect",
});

export const USER_ACCOUNT_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "restaurant:userAccountExistsIncorrect",
});

export const MODIFY_PASSWORD_CAPTCHA_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "restaurant:modifyPasswordCaptchaIncorrect",
});

// ----------------------------------------------------------------------

export const RESTAURANT_NOT_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "restaurant:restaurantNotExistsIncorrect",
});

export const BRAND_NOT_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "restaurant:brandNotExistsIncorrect",
});

export const REGION_NOT_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "restaurant:regionNotExistsIncorrect",
});

// ----------------------------------------------------------------------

export const NFC_NOT_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "restaurant:nfcNotExistsIncorrect",
});

export const NFC_RESTAURANT_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "restaurant:nfcRestaurantExistsIncorrect",
});

// ----------------------------------------------------------------------

export const GIFT_NOT_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "restaurant:giftNotExistsIncorrect",
});

export const GIFT_NAME_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "restaurant:giftNameExistsIncorrect",
});

// ----------------------------------------------------------------------

export const CLOCK_IN_NOT_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "restaurant:clockInNotExistsIncorrect",
});

export const CLOCK_IN_ENABLED_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "restaurant:clockInEnabledExistsIncorrect",
});

export const CLOCK_IN_NAME_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "restaurant:clockInNameExistsIncorrect",
});

// ----------------------------------------------------------------------

export const LUCKY_DRAW_NOT_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "restaurant:luckyDrawNotExistsIncorrect",
});

export const LUCKY_DRAW_ENABLED_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "restaurant:luckyDrawEnabledExistsIncorrect",
});

export const LUCKY_DRAW_NAME_EXISTS_INCORRECT = wrappError({
  code: "PRECONDITION_FAILED",
  message: "restaurant:luckyDrawNameExistsIncorrect",
});

export const LUCKY_DRAW_TOTAL_PROBABILITY_ERROR = wrappError({
  code: "PRECONDITION_FAILED",
  message: "restaurant:luckyDrawTotalProbabilityError",
});

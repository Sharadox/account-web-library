import type { EmailAddress } from "@sharadox/email-web-library/email-address/type";
import type { EmailDesign } from "@sharadox/email-web-library/email-layout/type";
import type { InlineImage } from "@sharadox/email-web-library/email-message/type";
import type { EmailSender } from "@sharadox/email-web-library/email-sender/type";

export interface EmailChannelOptions {
  /** From email-web-library (`createAmazonSesSender`…). */
  sender: EmailSender;
  /** The sending address, for example `"Luis Pires Decor" <account@web.luispiresdecor.com>`. */
  from: EmailAddress;
  /** The company's name, logo size and signature (email-web-library's layout). */
  design: EmailDesign;
  /** The inline images "logo" and "logo-dark", when the design shows a logo. */
  logos?: InlineImage[];
  /** The clock, for how long the code still works (Date.now by default). */
  now?: () => number;
}

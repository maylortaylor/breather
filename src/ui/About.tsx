import * as stylex from "@stylexjs/stylex";
import { colors } from "../theme.stylex";

const styles = stylex.create({
  about: { margin: 0, fontSize: 13, lineHeight: 1.5, color: colors.textMuted },
  link: { color: colors.tabInk, textDecoration: "underline" },
});

/** Where the build writes the licence text of everything it ships. Works under any base. */
export const NOTICES_HREF = `${import.meta.env.BASE_URL}notices.txt`;

/** The credits line: the font and the two libraries that make the page, plus the notices. */
export function About() {
  return (
    <p {...stylex.props(styles.about)}>
      Breather is open source (MIT). Set in Nunito (SIL OFL). Built with three.js (MIT) and React
      (MIT).{" "}
      <a href={NOTICES_HREF} target="_blank" rel="noopener" {...stylex.props(styles.link)}>
        Licence notices
      </a>
    </p>
  );
}

import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  page: { minHeight: "100vh", backgroundColor: "#0b1020", color: "#e8ecf8", padding: 24 },
});

export function Lab() {
  return <main {...stylex.props(styles.page)}>Listening Lab</main>;
}

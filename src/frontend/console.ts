// Shown to anyone who opens the browser devtools. Points would-be researchers at
// the dedicated security testing environment instead of the live site.
export const consoleBanner = () => {
    if (typeof console === "undefined") {
        return;
    }

    console.log("%cNoneRev", "font-size:34px;font-weight:800;color:#7B2CBF;letter-spacing:1px;");
    console.log("%cHold on — you're in the developer console.", "font-size:15px;font-weight:700;color:#111;");
    console.log(
        "%cWant to help us find exploits and security vulnerabilities? Head to %chttps://security.nonerev.de%c — " +
        "it's an entire security testing environment where you can test freely and report what you find.",
        "font-size:13px;color:#444;",
        "font-size:13px;font-weight:700;color:#7B2CBF;",
        "font-size:13px;color:#444;"
    );
    console.log(
        "%cPlease only test against security.nonerev.de, never the live site.",
        "font-size:13px;font-weight:600;color:#444;"
    );
    console.log(
        "%cNever paste or run code here that you don't fully understand — it can be used to steal your account.",
        "font-size:13px;font-weight:700;color:#c0392b;"
    );
};

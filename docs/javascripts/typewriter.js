(() => {
  const TYPE_SPEED = 90;
  const DELETE_SPEED = 55;
  const FULL_TEXT_PAUSE = 1800;
  const EMPTY_TEXT_PAUSE = 450;

  const initializeTypewriter = () => {
    const hero = document.querySelector(".home-hero[data-typewriter-text]");
    const typewriter = hero?.querySelector(".home-hero__typewriter");
    const output = hero?.querySelector(".typewriter-text");

    if (!hero || !typewriter || !output || hero.dataset.typewriterInitialized === "true") {
      return;
    }

    hero.dataset.typewriterInitialized = "true";
    document.body.classList.add("home-page");

    const phrase = hero.dataset.typewriterText || "";
    const characters = Array.from(phrase);

    typewriter.setAttribute("aria-label", phrase);

    let characterCount = 0;
    let isDeleting = false;

    const render = () => {
      output.textContent = characters.slice(0, characterCount).join("");
    };

    const update = () => {
      if (!isDeleting) {
        characterCount += 1;
        render();

        if (characterCount === characters.length) {
          isDeleting = true;
          window.setTimeout(update, FULL_TEXT_PAUSE);
          return;
        }

        window.setTimeout(update, TYPE_SPEED);
        return;
      }

      characterCount -= 1;
      render();

      if (characterCount === 0) {
        isDeleting = false;
        window.setTimeout(update, EMPTY_TEXT_PAUSE);
        return;
      }

      window.setTimeout(update, DELETE_SPEED);
    };

    if (characters.length > 0) {
      update();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeTypewriter, { once: true });
  } else {
    initializeTypewriter();
  }
})();

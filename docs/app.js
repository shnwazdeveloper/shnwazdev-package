const copyButtons = document.querySelectorAll("[data-copy]");
const filterButtons = document.querySelectorAll("[data-filter]");
const apiCards = document.querySelectorAll("[data-group]");
const navLinks = document.querySelectorAll(".docs-tabs a, .top-nav a");
const sections = [...document.querySelectorAll("main section[id]")];
const motionTargets = document.querySelectorAll("[data-motion]");

for (const button of copyButtons) {
  button.addEventListener("click", async () => {
    const value = button.dataset.copy ?? "";
    try {
      await navigator.clipboard.writeText(value);
      const original = button.textContent;
      button.textContent = "Copied";
      window.setTimeout(() => {
        button.textContent = original;
      }, 1400);
    } catch {
      button.textContent = "Select";
    }
  });
}

for (const button of filterButtons) {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    for (const item of filterButtons) {
      item.classList.toggle("active", item === button);
    }
    for (const card of apiCards) {
      card.hidden = filter !== "all" && card.dataset.group !== filter;
    }
  });
}

const navObserver = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

    if (!visible) {
      return;
    }

    const id = visible.target.id;
    for (const link of navLinks) {
      link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
    }
  },
  {
    rootMargin: "-25% 0px -60% 0px",
    threshold: [0.1, 0.3, 0.6]
  }
);

for (const section of sections) {
  navObserver.observe(section);
}

const motionObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        motionObserver.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.14 }
);

for (const target of motionTargets) {
  motionObserver.observe(target);
}

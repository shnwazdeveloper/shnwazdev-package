export const packageName = "@shnwazdeveloper/shnwazdev";

export function greet(name = "developer") {
  return `Hello, ${name}! Welcome to shnwazdev.`;
}

export function profile() {
  return {
    owner: "shnwazdeveloper",
    brand: "shnwazdev",
    packageName,
    registry: "GitHub Packages"
  };
}

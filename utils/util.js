const toggleBtn = document.getElementById("dark-toggle");

// Load saved preference
if(localStorage.getItem("theme") === "dark"){
    document.body.classList.add("dark-mode");
    toggleBtn.setAttribute("aria-pressed", "true");
}

toggleBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");

    if(document.body.classList.contains("dark-mode")){
        localStorage.setItem("theme", "dark");
        toggleBtn.setAttribute("aria-pressed", "true");
    } else {
        localStorage.setItem("theme", "light");
        toggleBtn.setAttribute("aria-pressed", "false");
    }
});

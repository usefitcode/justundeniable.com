// Confetti Party
document.addEventListener("DOMContentLoaded", function() {
    // Check for confetti library
    if (!window.confetti) {
        console.error('Canvas-confetti library not loaded! Include: https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js');
        return;
    }
    
    // Global function to trigger confetti programmatically
    window.triggerConfetti = function(effect) {
        if (!window.confetti) return;
        
        switch (effect) {
                case "falling":
                    var makeFall = function() {
                        confetti({
                            particleCount: 100,
                            startVelocity: 30,
                            spread: 360,
                            origin: { x: Math.random(), y: 0 },
                            colors: ['#ffffff','#ff0000','#00ff00','#0000ff']
                        });
                    };
                    setInterval(makeFall, 2000);
                    break;
                case "single":
                    confetti({
                        particleCount: 1,
                        startVelocity: 30,
                        spread: 360,
                        origin: { x: Math.random(), y: Math.random() }
                    });
                    break;
                case "sides":
                    confetti({
                        particleCount: 100,
                        startVelocity: 30,
                        spread: 360,
                        origin: { x: Math.random(), y: 0.5 }
                    });
                    break;
                case "explosions":
                    confetti({
                        particleCount: 100,
                        startVelocity: 50,
                        spread: 360
                    });
                    break;
                case "bottom":
                    confetti({
                        particleCount: 100,
                        startVelocity: 30,
                        spread: 360,
                        origin: { x: 0.5, y: 1 }
                    });
                    break;
                default:
                    console.log("Unknown confetti effect");
        }
    };
    
    // Set up click handlers for elements with ms-code-confetti attribute
    // BUT skip elements that also have mark-complete-btn class (handled by completion-tracking.js)
    const confettiElems = document.querySelectorAll("[ms-code-confetti]");
    confettiElems.forEach(function(item) {
        // Skip mark-complete buttons - they handle their own confetti timing
        if (item.classList.contains('mark-complete-btn')) {
            console.log('Skipping confetti click handler for mark-complete button');
            return;
        }
        
        console.log('Adding confetti click handler for element:', item);
        item.addEventListener("click", function() {
            const effect = item.getAttribute("ms-code-confetti");
            window.triggerConfetti(effect);
        });
    });
}); 
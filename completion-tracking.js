// Completion Tracking Script + Play/Complete Buttons
document.addEventListener("DOMContentLoaded", function() {
  // Add global error handler to catch issues
  window.addEventListener('error', function(event) {
    console.error('Script error detected:', event.error);
  });
  
  // Browser compatibility check with detailed logging
  var browserInfo = {
    userAgent: navigator.userAgent,
    hasPromise: !!window.Promise,
    hasMemberstack: !!window.$memberstackDom,
    timestamp: new Date().toISOString()
  };
  console.log('Browser environment:', browserInfo);
  // Enhanced Memberstack readiness check
  function waitForMemberstack(callback, maxAttempts) {
    maxAttempts = maxAttempts || 15; // 3 seconds total
    
    if (window.$memberstackDom && 
        window.$memberstackDom.getCurrentMember && 
        window.$memberstackDom.getMemberJSON &&
        window.$memberstackDom.updateMemberJSON) {
      console.log('Memberstack ready, initializing completion tracking');
      callback();
    } else if (maxAttempts > 0) {
      setTimeout(function() {
        waitForMemberstack(callback, maxAttempts - 1);
      }, 200);
    } else {
      console.error('Memberstack failed to load after 3 seconds - required methods not available');
    }
  }
  
  // Extension conflict detection
  function detectExtensionConflicts() {
    // Test for ad blockers
    var testAd = document.createElement('div');
    testAd.innerHTML = '&nbsp;';
    testAd.className = 'adsbox';
    testAd.style.position = 'absolute';
    testAd.style.left = '-999px';
    document.body.appendChild(testAd);
    
    setTimeout(function() {
      var isAdBlocked = testAd.offsetHeight === 0;
      if (isAdBlocked) {
        console.warn('Ad blocker detected - may interfere with Memberstack API calls');
      }
      document.body.removeChild(testAd);
    }, 100);
    
    // Test for privacy extensions blocking third-party requests
    if (navigator.doNotTrack === '1') {
      console.info('Do Not Track enabled - privacy extensions may be active');
    }
  }
  
  waitForMemberstack(function() {
    detectExtensionConflicts();
    
    // Check for confetti library
    if (!window.confetti) {
      console.warn('Confetti library not loaded - celebrations will be disabled');
    }
    
    const buttons = document.querySelectorAll('.mark-complete-btn');
    const progressText = document.querySelector('[data-progress-element="text"]');
    const progressBar = document.querySelector('[data-progress-element="bar"]');
    const iconContainers = document.querySelectorAll('[data-icon-container]');
    const totalCount = buttons.length;

    function updateProgress(completedData) {
      const completedCount = Array.from(buttons).filter(function(btn) {
        const videoId = btn.dataset.videoId;
        const phaseId = btn.dataset.phaseId;
        return completedData[phaseId] && completedData[phaseId].includes(videoId);
      }).length;

      if (progressText) progressText.textContent = `${completedCount}/${totalCount}`;
      if (progressBar) {
        const percentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
        progressBar.style.width = percentage + '%';
      }
    }

    function updateIcons(completedData) {
      iconContainers.forEach(function(container) {
        const videoId = container.dataset.videoId;
        const phaseId = container.dataset.phaseId;
        if (!videoId || !phaseId) return;
        
        const playIcon = container.querySelector('img[data-icon="play"]');
        const checkIcon = container.querySelector('img[data-icon="check"]');
        if (!playIcon || !checkIcon) return;
        
        const isCompleted = completedData[phaseId] && completedData[phaseId].includes(videoId);
        playIcon.style.display = isCompleted ? 'none' : 'block';
        checkIcon.style.display = isCompleted ? 'block' : 'none';
      });
    }

    // Browser compatibility check
    if (!window.Promise) {
      console.error('Browser not supported - missing Promise support');
      return;
    }

    window.$memberstackDom.getCurrentMember()
      .then(function(result) {
        const member = result.data;
        if (!member) return Promise.reject('No member found');
        
        return window.$memberstackDom.getMemberJSON();
      })
      .then(function(result) {
        const memberJson = result.data || {};
        memberJson.completedContent = memberJson.completedContent || {};
      
        // Safe button text update function
        function updateButtonText(btn, isCompleted) {
          var newText = isCompleted ? 'Completed' : 'Mark Complete';
          try {
            btn.textContent = newText;
            // Double-check it worked
            if (btn.textContent !== newText) {
              btn.innerText = newText; // Fallback
            }
            console.log('Button text updated to:', newText, 'for button:', btn);
          } catch (e) {
            console.error('Failed to update button text:', e);
          }
        }

        // Initialize UI - buttons and icons
        buttons.forEach(function(btn) {
          const videoId = btn.dataset.videoId;
          const phaseId = btn.dataset.phaseId;
          if (!videoId || !phaseId) {
            console.warn('Button missing required data attributes:', btn);
            return;
          }
          
          const isCompleted = memberJson.completedContent[phaseId] && memberJson.completedContent[phaseId].includes(videoId);
          updateButtonText(btn, isCompleted);
          btn.classList.toggle('is-completed', isCompleted);
        });
        
        updateProgress(memberJson.completedContent);
        updateIcons(memberJson.completedContent);

        // Add click handlers with debouncing
        buttons.forEach(function(btn) {
          var clickTimeout = null;
          
          btn.addEventListener('click', function() {
            const videoId = btn.dataset.videoId;
            const phaseId = btn.dataset.phaseId;
            if (!videoId || !phaseId) return;
            
            // Debounce rapid clicks
            if (clickTimeout) return;
            clickTimeout = setTimeout(function() { clickTimeout = null; }, 1000);
            
            btn.disabled = true;
            
            // Show loading state
            const originalText = btn.textContent;
            btn.textContent = '⏳ Saving...';
            btn.classList.add('is-loading');
            
            const completedData = memberJson.completedContent;
            const wasAlreadyCompleted = completedData[phaseId] && completedData[phaseId].includes(videoId);
            const isMarkingComplete = !wasAlreadyCompleted; // True if we're marking complete, false if un-marking
            
            console.log('Button action:', isMarkingComplete ? 'marking complete' : 'un-marking complete');
            
            if (wasAlreadyCompleted) {
              // Un-marking: remove from completed array
              completedData[phaseId] = completedData[phaseId].filter(function(id) { return id !== videoId; });
            } else {
              // Marking complete: add to completed array
              completedData[phaseId] = completedData[phaseId] || [];
              completedData[phaseId].push(videoId);
            }

            // Retry logic for network failures
            function attemptUpdate(retryCount) {
              return window.$memberstackDom.updateMemberJSON({ json: memberJson })
                .then(function() {
                  // Success state
                  updateButtonText(btn, isMarkingComplete);
                  btn.classList.remove('is-loading');
                  btn.classList.toggle('is-completed', isMarkingComplete);
                  
                  // Trigger confetti only when marking complete (not un-marking)
                  if (isMarkingComplete && window.triggerConfetti) {
                    console.log('Triggering confetti for completion!');
                    const confettiEffect = btn.getAttribute('ms-code-confetti') || 'explosions';
                    window.triggerConfetti(confettiEffect);
                  } else {
                    console.log('No confetti - either un-marking or no triggerConfetti function');
                  }
                  
                  updateProgress(completedData);
                  updateIcons(completedData);
                  btn.disabled = false;
                })
                .catch(function(err) {
                  console.error("Update failed (attempt " + (2 - retryCount) + "):", err);
                  
                  // Retry once on network errors
                  if (retryCount > 0 && (err.message.includes('network') || err.message.includes('fetch') || err.name === 'NetworkError')) {
                    console.log('Retrying update in 1 second...');
                    btn.textContent = '🔄 Retrying...';
                    return new Promise(function(resolve) {
                      setTimeout(function() {
                        resolve(attemptUpdate(retryCount - 1));
                      }, 1000);
                    });
                  } else {
                    // Final failure - show error and revert UI
                    btn.textContent = '❌ Failed';
                    btn.classList.remove('is-loading');
                    btn.classList.add('is-error');
                    
                    // Revert to original state after 2 seconds
                    setTimeout(function() {
                      updateButtonText(btn, wasAlreadyCompleted);
                      btn.classList.remove('is-error');
                      btn.classList.toggle('is-completed', wasAlreadyCompleted);
                      btn.disabled = false;
                    }, 2000);
                    
                    throw err;
                  }
                });
            }
            
            attemptUpdate(1);
          });
        });
      })
      .catch(function(error) {
        console.error('Initialization failed:', error);
      });
  });
}); 
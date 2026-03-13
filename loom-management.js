// Function to pause a Loom iframe
function pauseLoomIframe(iframe) {
  if (!iframe) return;
  iframe.contentWindow.postMessage(
    { method: 'pause', context: 'player.js' },
    '*'
  );
}

// Lazy loading system - store original src and load on demand
var videoLoadingState = {
  loadedVideos: new Set(),
  loadingQueue: [],
  isProcessingQueue: false
};

function storeVideoSources() {
  document.querySelectorAll('iframe[data-video-tab-iframe]').forEach(function(iframe) {
    const originalSrc = iframe.src;
    if (originalSrc && originalSrc.includes('loom.com')) {
      // Store original src and clear it for lazy loading
      iframe.setAttribute('data-original-src', originalSrc);
      iframe.removeAttribute('src');
      console.log('Stored video source for lazy loading:', iframe.getAttribute('data-video-tab-iframe'));
    }
  });
}

function loadVideo(iframe, priority) {
  if (!iframe) return;
  
  const videoSlug = iframe.getAttribute('data-video-tab-iframe');
  const originalSrc = iframe.getAttribute('data-original-src');
  
  if (!originalSrc || videoLoadingState.loadedVideos.has(videoSlug)) {
    return;
  }
  
  console.log('Loading video with priority', priority + ':', videoSlug);
  iframe.src = originalSrc;
  videoLoadingState.loadedVideos.add(videoSlug);
}

function processLoadingQueue() {
  if (videoLoadingState.isProcessingQueue || videoLoadingState.loadingQueue.length === 0) {
    return;
  }
  
  videoLoadingState.isProcessingQueue = true;
  
  // Sort by priority (lower number = higher priority)
  videoLoadingState.loadingQueue.sort(function(a, b) { return a.priority - b.priority; });
  
  // Load one video at a time with staggered delays
  var index = 0;
  function loadNext() {
    if (index >= videoLoadingState.loadingQueue.length) {
      videoLoadingState.isProcessingQueue = false;
      videoLoadingState.loadingQueue = [];
      return;
    }
    
    var item = videoLoadingState.loadingQueue[index];
    loadVideo(item.iframe, item.priority);
    index++;
    
    // Stagger loading to prevent overwhelming the browser
    setTimeout(loadNext, item.priority === 1 ? 0 : 500); // Active tab loads immediately, others wait 500ms
  }
  
  loadNext();
}

function queueVideoLoad(iframe, priority) {
  const videoSlug = iframe.getAttribute('data-video-tab-iframe');
  if (videoLoadingState.loadedVideos.has(videoSlug)) {
    return;
  }
  
  // Remove any existing queue entry for this video
  videoLoadingState.loadingQueue = videoLoadingState.loadingQueue.filter(function(item) {
    return item.iframe !== iframe;
  });
  
  // Add to queue with priority
  videoLoadingState.loadingQueue.push({
    iframe: iframe,
    priority: priority,
    videoSlug: videoSlug
  });
  
  // Process queue
  setTimeout(processLoadingQueue, 100);
}

function loadVideosForActiveTab() {
  const activePane = document.querySelector('.w-tab-pane.w--tab-active');
  if (!activePane) return;
  
  // Priority 1: Load active tab video immediately
  const activeIframe = activePane.querySelector('iframe[data-video-tab-iframe]');
  if (activeIframe) {
    queueVideoLoad(activeIframe, 1);
  }
  
  // Priority 2: Load adjacent tabs (for quick navigation)
  const allTabs = document.querySelectorAll('.w-tab-pane');
  const activeIndex = Array.from(allTabs).indexOf(activePane);
  
  if (activeIndex > 0) {
    const prevTab = allTabs[activeIndex - 1];
    const prevIframe = prevTab.querySelector('iframe[data-video-tab-iframe]');
    if (prevIframe) queueVideoLoad(prevIframe, 2);
  }
  
  if (activeIndex < allTabs.length - 1) {
    const nextTab = allTabs[activeIndex + 1];
    const nextIframe = nextTab.querySelector('iframe[data-video-tab-iframe]');
    if (nextIframe) queueVideoLoad(nextIframe, 2);
  }
  
  // Priority 3: Load remaining videos after a delay (for complete caching)
  setTimeout(function() {
    document.querySelectorAll('iframe[data-video-tab-iframe]').forEach(function(iframe) {
      queueVideoLoad(iframe, 3);
    });
  }, 2000);
}

function pauseInactiveLoomVideos() {
  // Find the active tab's slug
  const activePane = document.querySelector('.w-tab-pane.w--tab-active');
  if (!activePane) return;
  // Find the active slug (from the iframe in the active pane)
  const activeIframe = activePane.querySelector('iframe[data-video-tab-iframe]');
  const activeSlug = activeIframe ? activeIframe.getAttribute('data-video-tab-iframe') : null;

  // Pause all Loom iframes except the one in the active pane
  document.querySelectorAll('iframe[data-video-tab-iframe]').forEach(function(iframe) {
    const videoSlug = iframe.getAttribute('data-video-tab-iframe');
    if (videoSlug !== activeSlug && iframe.src) { // Only pause if video is loaded
      pauseLoomIframe(iframe);
    }
  });
}

// Observe for changes to the active tab pane
window.addEventListener('DOMContentLoaded', function() {
  // Give Finsweet time to inject content first
  setTimeout(function() {
    const tabContent = document.querySelector('[fs-list-element="tabs"]');
    if (!tabContent) return;

    // Step 1: Store all video sources for lazy loading
    storeVideoSources();
    
    // Step 2: Load videos for the initially active tab
    loadVideosForActiveTab();

    // Use a MutationObserver to watch for class changes (tab switches only)
    const observer = new MutationObserver(function(mutations) {
      // Only respond to class changes on tab panes (actual tab switches)
      const hasTabSwitch = mutations.some(function(mutation) {
        return mutation.type === 'attributes' && 
               mutation.attributeName === 'class' &&
               mutation.target.classList.contains('w-tab-pane');
      });
      
      if (hasTabSwitch) {
        setTimeout(function() {
          pauseInactiveLoomVideos();
          loadVideosForActiveTab(); // Load videos for newly active tab
        }, 100); // Small delay for tab transition
      }
    });

    // Watch for class changes only on tab panes
    document.querySelectorAll('.w-tab-pane').forEach(function(pane) {
      observer.observe(pane, { 
        attributes: true, 
        attributeFilter: ['class'] 
      });
    });

    // Also run once after initial setup
    setTimeout(function() {
      pauseInactiveLoomVideos();
    }, 200);
    
  }, 1000); // Wait for Finsweet injection to complete
}); 
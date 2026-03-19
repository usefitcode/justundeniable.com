// Bunny.net Video Embed - Simple Attribute-Based with OEmbed Thumbnails
// Add this to Page Settings → Custom Code → Footer Code
//
// PERFORMANCE: This script defers all work until after page load to avoid blocking.
// Thumbnails load only when images intersect viewport AND during browser idle time.
//
// Setup:
// 1. Add data-video-id="{{slug}}" (or any unique CMS field) to:
//    - Poster image
//    - Play button
//    - Iframe wrapper (Embed element)
//
// 2. For multiple marquees/collection lists with the same videos, add a unique identifier
//    to the collection list wrapper (e.g., data-collection-list="marquee-1"):
//    - data-collection-list="unique-id" OR
//    - data-marquee-id="unique-id" OR
//    - data-video-container="unique-id"

(function () {
    'use strict';

    function isPosterElement(el) {
        return el.tagName === 'IMG' || el.classList.contains('video-poster');
    }

    function deferToIdle(fn, idleTimeout, fallbackMs) {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(fn, { timeout: idleTimeout });
        } else {
            setTimeout(fn, fallbackMs);
        }
    }

    function extractVideoInfo(url) {
        const match = url.match(/iframe\.mediadelivery\.net\/(?:embed|play)\/([^\/]+)\/([^\/\?]+)/);
        if (!match) {
            return null;
        }
        return { libraryId: match[1], videoId: match[2] };
    }

    // Extract video ID from data-video-id attribute (handles both URLs and IDs)
    function normalizeVideoId(videoIdAttr) {
        if (!videoIdAttr || videoIdAttr.trim() === '') return null;

        // If it's already just an ID (UUID format), return it
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(videoIdAttr)) {
            return videoIdAttr;
        }

        // If it's a full URL, extract the video ID
        const videoInfo = extractVideoInfo(videoIdAttr);
        if (videoInfo) {
            return videoInfo.videoId;
        }

        // Return as-is if we can't parse it
        return videoIdAttr;
    }

    // Convert a /play/ or /embed/ Bunny URL to the /embed/ form
    function toEmbedUrl(url) {
        if (!url || !url.includes('mediadelivery.net')) return url;
        return url.replace('/play/', '/embed/');
    }

    // Build a proper embed URL from a data-video-id value (which may be a /play/ URL)
    // Falls back to the iframe's own data-src only if it's not a placeholder
    function resolveVideoUrl(iframeWrapper, iframe) {
        // 1. Prefer the wrapper's data-video-id (set from Webflow component props)
        const wrapperUrl = iframeWrapper.dataset.videoId;
        if (wrapperUrl && wrapperUrl.includes('mediadelivery.net')) {
            return toEmbedUrl(wrapperUrl);
        }

        // 2. Fall back to iframe data-src / src, but only if not a placeholder
        const iframeSrc = iframe.dataset.src || iframe.src;
        if (iframeSrc && !iframeSrc.includes('YOUR_LIBRARY_ID') && !iframeSrc.includes('YOUR_VIDEO_ID')) {
            return iframeSrc;
        }

        return null;
    }

    // Find the collection list container by looking for data-collection-list attribute
    function findCollectionListContainer(element) {
        return element.closest('[data-collection-list], [data-marquee-id], [data-video-container]') || document;
    }

    // Find elements by video ID, scoped to a specific collection list (for multiple instances)
    function findElementsByVideoId(videoId, contextElement = null) {
        const normalizedId = normalizeVideoId(videoId);
        if (!normalizedId) return { poster: null, iframeWrapper: null };

        let searchRoot = document;

        // If we have a context element, search within its collection list container
        if (contextElement) {
            searchRoot = findCollectionListContainer(contextElement);
        }

        // Try exact match first, then normalized match
        // Exact match with the raw videoId value (handles full URLs in data-video-id)
        let poster = searchRoot.querySelector(`img[data-video-id="${videoId}"], [data-video-id="${videoId}"].video-poster`);
        let iframeWrapper = searchRoot.querySelector(`[data-video-id="${videoId}"].video-iframe, [data-video-id="${videoId}"][data-video-iframe]`);

        // Try normalized UUID match if exact didn't work
        if (!poster) {
            poster = searchRoot.querySelector(`img[data-video-id="${normalizedId}"], [data-video-id="${normalizedId}"].video-poster`);
        }
        if (!iframeWrapper) {
            iframeWrapper = searchRoot.querySelector(`[data-video-id="${normalizedId}"].video-iframe, [data-video-id="${normalizedId}"][data-video-iframe]`);
        }

        // If not found with exact match, check if contextElement itself matches
        if ((!poster || !iframeWrapper) && contextElement) {
            const contextVideoId = normalizeVideoId(contextElement.dataset.videoId);
            if (contextVideoId === normalizedId) {
                if (isPosterElement(contextElement) && !poster) {
                    poster = contextElement;
                }
                if ((contextElement.classList.contains('video-iframe') || contextElement.hasAttribute('data-video-iframe')) && !iframeWrapper) {
                    iframeWrapper = contextElement;
                }
            }
        }

        // If not found in collection list, try finding by matching normalized IDs within the container
        if ((!poster || !iframeWrapper) && searchRoot !== document) {
            const allPosters = searchRoot.querySelectorAll('img[data-video-id], [data-video-id].video-poster');
            const allWrappers = searchRoot.querySelectorAll('[data-video-id].video-iframe, [data-video-id][data-video-iframe]');

            if (!poster) {
                for (const el of allPosters) {
                    if (normalizeVideoId(el.dataset.videoId) === normalizedId) {
                        poster = el;
                        break;
                    }
                }
            }

            if (!iframeWrapper) {
                for (const el of allWrappers) {
                    if (normalizeVideoId(el.dataset.videoId) === normalizedId) {
                        iframeWrapper = el;
                        break;
                    }
                }
            }
        }

        return { poster, iframeWrapper };
    }

    function findIframe(wrapper) {
        if (wrapper.tagName === 'IFRAME') return wrapper;
        return wrapper.querySelector('iframe');
    }

    // Test if a thumbnail URL is accessible (not 403/404)
    async function testThumbnailUrl(url) {
        return new Promise((resolve) => {
            const img = new Image();
            let resolved = false;

            img.onload = () => {
                if (!resolved) {
                    resolved = true;
                    resolve(true);
                }
            };

            img.onerror = () => {
                if (!resolved) {
                    resolved = true;
                    resolve(false);
                }
            };

            img.src = url;

            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    resolve(false);
                }
            }, 1000);
        });
    }

    async function getThumbnailUrl(embedUrl) {
        try {
            const oembedUrl = `https://video.bunnycdn.com/OEmbed?url=${encodeURIComponent(embedUrl)}`;
            const response = await fetch(oembedUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();

            if (data.thumbnail_url) {
                const isAccessible = await testThumbnailUrl(data.thumbnail_url);
                if (isAccessible) {
                    return data.thumbnail_url;
                }
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    function generateFallbackThumbnailUrl(videoInfo, pullZone = null) {
        const { videoId, libraryId } = videoInfo;
        const urls = [];

        const filenames = ['preview.jpg', 'thumbnail.jpg', 'thumb.jpg', 'poster.jpg', 'cover.jpg'];

        if (pullZone) {
            filenames.forEach(f => {
                urls.push(`https://${pullZone}.b-cdn.net/${videoId}/${f}`);
            });
        }

        const pullZonePatterns = [
            `vz-${libraryId}.b-cdn.net`,
            `vz${libraryId}.b-cdn.net`,
            `cdn-${libraryId}.b-cdn.net`,
            `${libraryId}.b-cdn.net`
        ];

        pullZonePatterns.forEach(zone => {
            filenames.forEach(f => {
                urls.push(`https://${zone}/${videoId}/${f}`);
            });
        });

        urls.push(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}/thumbnail`);

        return urls;
    }

    async function tryFallbackThumbnails(videoInfo, pullZone = null) {
        const fallbackUrls = generateFallbackThumbnailUrl(videoInfo, pullZone);
        const urlsToTest = fallbackUrls.slice(0, 5);

        for (const url of urlsToTest) {
            const works = await testThumbnailUrl(url);
            if (works) {
                return url;
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        return null;
    }

    async function loadThumbnail(videoId, contextElement = null) {
        const normalizedId = normalizeVideoId(videoId);

        if (!normalizedId) {
            return;
        }

        const { poster, iframeWrapper } = findElementsByVideoId(videoId, contextElement);

        if (!poster || !iframeWrapper) {
            return;
        }

        const iframe = findIframe(iframeWrapper);
        if (!iframe) {
            return;
        }

        // Resolve the real video URL from wrapper's data-video-id (component prop),
        // falling back to iframe data-src only if it's not a placeholder
        const videoUrl = resolveVideoUrl(iframeWrapper, iframe);
        if (!videoUrl) {
            return;
        }

        // Patch the iframe data-src so click handler also uses the correct URL
        iframe.dataset.src = videoUrl;

        // Check if thumbnail is already loaded
        const currentSrc = poster.src || '';
        const currentDataSrc = poster.dataset.src || '';
        const hasRealThumbnail = (currentSrc.includes('b-cdn.net') || currentSrc.includes('bunnycdn.com') ||
            currentDataSrc.includes('b-cdn.net') || currentDataSrc.includes('bunnycdn.com'));

        if (hasRealThumbnail) {
            return;
        }

        const loadThumbnailAsync = async () => {
            let thumbnailUrl = await getThumbnailUrl(videoUrl);

            if (!thumbnailUrl) {
                const videoInfo = extractVideoInfo(videoUrl);
                if (videoInfo) {
                    const pullZone = iframeWrapper.dataset.pullZone || iframe.dataset.pullZone;
                    thumbnailUrl = await tryFallbackThumbnails(videoInfo, pullZone);
                }
            }

            if (!thumbnailUrl) {
                return;
            }

            if (poster.tagName === 'IMG') {
                if (!poster.style.aspectRatio && !poster.width && !poster.height) {
                    poster.style.aspectRatio = '16 / 9';
                    poster.style.objectFit = 'cover';
                }

                poster.dataset.src = thumbnailUrl;
                poster.src = thumbnailUrl;

                poster.onerror = () => {
                    poster.src = '';
                };
            } else {
                if (!poster.style.aspectRatio) {
                    poster.style.aspectRatio = '16 / 9';
                }
                poster.dataset.bgSrc = thumbnailUrl;
                poster.style.backgroundImage = `url(${thumbnailUrl})`;
                poster.style.backgroundSize = 'cover';
                poster.style.backgroundPosition = 'center';
            }
        };

        deferToIdle(loadThumbnailAsync, 3000, 200);
    }

    document.addEventListener('click', (e) => {
        const button = e.target.closest('[data-video-id]');
        if (!button) return;

        const videoId = button.dataset.videoId;
        const normalizedId = normalizeVideoId(videoId);
        if (!normalizedId) return;

        // Use the button as context to find elements in the same video block
        const { iframeWrapper } = findElementsByVideoId(videoId, button);
        if (!iframeWrapper) return;

        const iframe = findIframe(iframeWrapper);
        if (!iframe || iframe.src) return;

        // Resolve the real video URL from wrapper's data-video-id,
        // falling back to iframe data-src only if not a placeholder
        const videoUrl = resolveVideoUrl(iframeWrapper, iframe);
        if (!videoUrl) return;

        iframe.src = `${videoUrl}${videoUrl.includes('?') ? '&' : '?'}autoplay=true&preload=false`;
        iframe.style.display = 'block';

        // Use the button as context to find the poster in the same video block
        const { poster } = findElementsByVideoId(videoId, button);
        if (poster) poster.style.display = 'none';
        button.style.display = 'none';
    });

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const videoId = img.dataset.videoId;
                    const normalizedId = normalizeVideoId(videoId);

                    if (normalizedId) {
                        deferToIdle(() => loadThumbnail(videoId, img), 2000, 100);
                    }

                    if (img.dataset.src && !img.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                    }
                    if (img.dataset.bgSrc) {
                        img.style.backgroundImage = `url(${img.dataset.bgSrc})`;
                        img.removeAttribute('data-bgSrc');
                    }

                    observer.unobserve(img);
                }
            });
        }, { rootMargin: '200px' });

        const observedElements = new WeakSet();

        function observeVideoElements(root) {
            root.querySelectorAll('[data-video-id]').forEach(el => {
                if (observedElements.has(el)) return;
                if (isPosterElement(el)) {
                    observedElements.add(el);
                    observer.observe(el);
                }
            });
        }

        function waitForPageReady() {
            if (document.readyState === 'complete') {
                deferToIdle(() => observeVideoElements(document), 2000, 500);
            } else {
                window.addEventListener('load', () => {
                    deferToIdle(() => observeVideoElements(document), 2000, 500);
                }, { once: true });
            }
        }

        waitForPageReady();

        const domObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    if (node.dataset && node.dataset.videoId && isPosterElement(node)) {
                        if (!observedElements.has(node)) {
                            observedElements.add(node);
                            observer.observe(node);
                        }
                    }
                    if (node.children && node.children.length > 0) {
                        observeVideoElements(node);
                    }
                }
            }
        });

        if (document.body) {
            domObserver.observe(document.body, { childList: true, subtree: true });
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                domObserver.observe(document.body, { childList: true, subtree: true });
            }, { once: true });
        }
    }
})();

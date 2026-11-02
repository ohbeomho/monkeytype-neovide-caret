;(() => {
    const CANVAS_ID = "neovide-caret-canvas"
    const STYLE_ID = "neovide-caret-style"
    const CORNER_DIRECTIONS = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
    ]

    const style = document.createElement("style")
    style.id = STYLE_ID
    style.textContent = `
    #${CANVAS_ID} {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      z-index: 2147483646;
      pointer-events: none;
    }

    #caret.neovide-caret-hidden {
      opacity: 0 !important;
      animation: none !important;
    }
  `
    ;(document.head || document.documentElement).append(style)

    const canvas = document.createElement("canvas")
    canvas.id = CANVAS_ID
    canvas.setAttribute("aria-hidden", "true")
    document.documentElement.append(canvas)
    const context = canvas.getContext("2d")
    if (!context) return

    const target = { x: 0, y: 0, width: 0, height: 0, visible: false }
    const cursor = { initialized: false }
    const vertices = CORNER_DIRECTIONS.map(() => ({ x: 0, y: 0 }))
    const targetVertices = CORNER_DIRECTIONS.map(() => ({ x: 0, y: 0 }))
    const cornerOrder = [0, 1, 2, 3]
    let pixelRatio = 1

    // Initial cursor x position
    let zeroPosX = { value: 0, initialized: false }
    let initialCandidate = null
    let stableFrames = 0

    function setCornerOrder(nextX, nextY) {
        if (nextX <= zeroPosX.value + 10) {
            cornerOrder[3] = 0
            cornerOrder[0] = 1
            cornerOrder[2] = 2
            cornerOrder[1] = 3
            return
        }

        const distances = targetVertices.map((vertex) =>
            Math.hypot(nextX - vertex.x, nextY - vertex.y),
        )
        const sortedIndices = [0, 1, 2, 3].sort(
            (a, b) => distances[a] - distances[b],
        )
        for (let rank = 0; rank < sortedIndices.length; rank++) {
            cornerOrder[sortedIndices[rank]] = rank
        }
    }

    function resizeCanvas() {
        pixelRatio = Math.max(window.devicePixelRatio || 1, 1)
        canvas.width = Math.round(window.innerWidth * pixelRatio)
        canvas.height = Math.round(window.innerHeight * pixelRatio)
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

        zeroPosX.initialized = false
    }

    function readCaret() {
        const nativeCaret = document.getElementById("caret")
        if (!nativeCaret) {
            canvas.style.display = "none"
            target.visible = false
            return
        }

        const caretRect = nativeCaret.getBoundingClientRect()
        const computed = getComputedStyle(nativeCaret)
        const hiddenBySite =
            nativeCaret.classList.contains("hidden") ||
            computed.display === "none" ||
            computed.visibility === "hidden" ||
            caretRect.width === 0 ||
            caretRect.height === 0

        if (hiddenBySite) {
            nativeCaret.classList.remove("neovide-caret-hidden")
            canvas.style.display = "none"
            target.visible = false
            return
        }

        nativeCaret.classList.add("neovide-caret-hidden")
        canvas.style.display = "block"

        const nextX = caretRect.left + caretRect.width / 2
        const nextY = caretRect.top + caretRect.height / 2
        const nextWidth = Math.max(caretRect.width, 1)
        const nextHeight = Math.max(caretRect.height, 1)

        if (cursor.initialized && (nextX !== target.x || nextY !== target.y))
            setCornerOrder(nextX, nextY)

        target.x = nextX
        target.y = nextY
        target.width = nextWidth
        target.height = nextHeight
        target.visible = true
    }

    function initializeCursor() {
        for (let i = 0; i < 4; i++) {
            const [dx, dy] = CORNER_DIRECTIONS[i]
            vertices[i].x = target.x + (target.width / 2) * dx
            vertices[i].y = target.y + (target.height / 2) * dy
            targetVertices[i].x = vertices[i].x
            targetVertices[i].y = vertices[i].y
        }
        cursor.initialized = true
    }

    function initializeZeroPosX() {
        if (zeroPosX.initialized) return

        const firstWord = document.querySelector("#words .word")
        if (!firstWord || !cursor.initialized) return

        zeroPosX.value =
            firstWord.getBoundingClientRect().left + target.width / 2
        zeroPosX.initialized = true
    }

    function animate() {
        readCaret()
        initializeZeroPosX()

        if (target.visible && !cursor.initialized) {
            initializeCursor()
        }

        if (target.visible && cursor.initialized) {
            context.clearRect(0, 0, window.innerWidth, window.innerHeight)

            for (let i = 0; i < 4; i++) {
                const [dx, dy] = CORNER_DIRECTIONS[i]
                targetVertices[i].x = target.x + (target.width / 2) * dx
                targetVertices[i].y = target.y + (target.height / 2) * dy
            }

            context.beginPath()
            context.moveTo(vertices[0].x, vertices[0].y)
            for (let i = 1; i < vertices.length; i++) {
                context.lineTo(vertices[i].x, vertices[i].y)
            }
            context.closePath()
            context.fillStyle =
                getComputedStyle(document.documentElement)
                    .getPropertyValue("--main-color")
                    .trim() || "#e2b714"
            context.globalAlpha = 0.35
            context.fill()
            context.globalAlpha = 1

            for (let i = 0; i < vertices.length; i++) {
                const dx = targetVertices[i].x - vertices[i].x
                const dy = targetVertices[i].y - vertices[i].y
                const distance = Math.hypot(dx, dy)
                if (distance < 1) {
                    vertices[i].x = targetVertices[i].x
                    vertices[i].y = targetVertices[i].y
                    continue
                }

                const speed = distance / (Math.pow(cornerOrder[i], 2) + 2)
                vertices[i].x += (dx / distance) * speed
                vertices[i].y += (dy / distance) * speed
            }
        } else {
            cursor.initialized = false
        }

        requestAnimationFrame(animate)
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas, { passive: true })
    window.addEventListener("scroll", readCaret, {
        passive: true,
        capture: true,
    })
    new MutationObserver(() => {
        readCaret()
    }).observe(document.documentElement, {
        childList: true,
        subtree: true,
    })
    requestAnimationFrame(animate)
})()

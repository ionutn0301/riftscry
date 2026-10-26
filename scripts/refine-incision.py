import cv2
import numpy as np

for champion in ['Azir', 'Camille']:
    source = cv2.imread(f'public/images/story/{champion}.jpg')
    prepared = cv2.imread(f'public/images/incision/{champion}-figure.webp', cv2.IMREAD_UNCHANGED)
    alpha = prepared[:, :, 3]
    inside = (alpha > 127).astype(np.uint8)
    core = cv2.erode(inside, np.ones((17, 17), np.uint8))
    outside = cv2.dilate(inside, np.ones((9, 9), np.uint8))
    mask = np.where(inside, cv2.GC_PR_FGD, cv2.GC_PR_BGD).astype(np.uint8)
    mask[outside == 0] = cv2.GC_BGD
    mask[core == 1] = cv2.GC_FGD
    cv2.grabCut(source, mask, None, np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64), 5, cv2.GC_INIT_WITH_MASK)
    refined = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    refined = cv2.GaussianBlur(refined, (3, 3), .45)
    result = cv2.cvtColor(source, cv2.COLOR_BGR2BGRA)
    result[:, :, 3] = refined
    cv2.imwrite(f'public/images/incision/{champion}-figure.webp', result, [cv2.IMWRITE_WEBP_QUALITY, 94])
    print(f'{champion}: refined source-only alpha, no generated or reconstructed pixels')

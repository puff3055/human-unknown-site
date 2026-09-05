(() => {
  'use strict';

  const IMAGE_WIDTH = 1672;
  const IMAGE_HEIGHT = 941;

  const VERTEX_SHADER = `
    precision highp float;

    attribute vec2 aPosition;
    varying vec2 vUv;

    void main() {
      vUv = aPosition * 0.5 + 0.5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  const FRAGMENT_SHADER = `
    precision highp float;

    varying vec2 vUv;

    uniform sampler2D uTexture;
    uniform vec2 uResolution;
    uniform vec2 uImageSize;
    uniform vec2 uGazePx;
    uniform vec2 uPointerPx;
    uniform float uTime;
    uniform float uAwareness;
    uniform float uStudy;
    uniform float uApproach;
    uniform float uPupilDilation;
    uniform vec3 uNarrative;
    uniform vec4 uFlow;
    uniform vec4 uLifeA[3];
    uniform vec4 uLifeB[3];
    uniform vec4 uWaveA[3];
    uniform vec4 uWaveB[3];
    uniform float uMotion;

    float luminance(vec3 color) {
      return dot(color, vec3(0.2126, 0.7152, 0.0722));
    }

    float hash21(vec2 point) {
      point = fract(point * vec2(123.34, 456.21));
      point += dot(point, point + 45.32);
      return fract(point.x * point.y);
    }

    vec2 coverUv(vec2 screenUv) {
      float screenAspect = uResolution.x / max(1.0, uResolution.y);
      float imageAspect = uImageSize.x / max(1.0, uImageSize.y);
      vec2 visible = vec2(1.0);

      if (screenAspect > imageAspect) {
        visible.y = imageAspect / screenAspect;
      } else {
        visible.x = screenAspect / imageAspect;
      }

      return vec2(0.5) + (screenUv - vec2(0.5)) * visible;
    }

    float sphereMask(vec2 sourceUv, vec2 center, float radius) {
      float imageAspect = uImageSize.x / max(1.0, uImageSize.y);
      vec2 delta = (sourceUv - center) * vec2(imageAspect, 1.0);
      return 1.0 - smoothstep(radius * 0.72, radius * 1.48, length(delta));
    }

    void main() {
      float screenAspect = uResolution.x / max(1.0, uResolution.y);
      vec2 metric = (vUv - vec2(0.5)) * vec2(screenAspect, 1.0) * 2.0;
      float radius = length(metric);
      vec2 radial = metric / max(radius, 0.0001);
      vec2 tangent = vec2(-radial.y, radial.x);

      float revealProgress = clamp(uNarrative.x, 0.0, 1.0);
      float zoomProgress = clamp(uNarrative.y, 0.0, 1.0);
      float entryProgress = clamp(uNarrative.z, 0.0, 1.0);
      // Entry scale is owned by the page transform so the entire eye advances
      // through one continuous Z-axis move. Sampling the texture at a second,
      // opposing scale here caused the old shrink-then-grow reversal.
      vec2 narrativeUv = vUv;

      vec2 baseSourceUv = coverUv(narrativeUv);
      float planetNeighborhood = max(
        sphereMask(baseSourceUv, vec2(0.5927, 0.8278), 0.0510),
        max(
          sphereMask(baseSourceUv, vec2(0.7081, 0.7056), 0.0790),
          sphereMask(baseSourceUv, vec2(0.3206, 0.3592), 0.0570)
        )
      );

      vec2 gazeMetric = vec2(uGazePx.x, -uGazePx.y)
        * 2.0 / max(1.0, uResolution.y);
      float gazeLength = length(gazeMetric);
      vec2 gazeDirection = gazeMetric / max(gazeLength, 0.0001);

      float pupilResponse = 1.0 - smoothstep(0.43, 1.02, radius);
      float middleResponse = smoothstep(0.45, 0.72, radius)
        * (1.0 - smoothstep(1.28, 1.82, radius));
      float tissueResponse = smoothstep(0.34, 0.58, radius)
        * (1.0 - smoothstep(1.43, 1.92, radius));
      float outerAnchor = 1.0 - smoothstep(1.54, 1.98, radius);
      float pupilEdge = smoothstep(0.32, 0.44, radius)
        * (1.0 - smoothstep(0.69, 0.87, radius));

      vec2 deformation = gazeMetric
        * (pupilResponse * 0.98 + middleResponse * 0.36)
        * uAwareness;

      float facing = dot(radial, gazeDirection);
      deformation += radial
        * (-facing * gazeLength)
        * (pupilEdge * 0.42 + middleResponse * 0.20)
        * uAwareness;

      float gazeBend = radial.x * gazeDirection.y - radial.y * gazeDirection.x;
      deformation += tangent
        * gazeBend
        * gazeLength
        * 0.105
        * middleResponse
        * uAwareness;

      float planetProtection = 1.0 - planetNeighborhood * 0.88;

      // The pupil opens only when the CPU curiosity model emits one reaction.
      // Autonomous life never drives this value, so idle time cannot pump it.
      deformation += radial
        * pupilEdge
        * uPupilDilation
        * 0.058
        * planetProtection;

      // Approaching gathers surrounding tissue without repeatedly scaling the pupil.
      float gatheringField = smoothstep(0.68, 0.84, radius)
        * (1.0 - smoothstep(1.42, 1.78, radius));
      deformation -= radial
        * gatheringField
        * uApproach
        * 0.018
        * planetProtection;
      deformation += tangent
        * sin(atan(metric.y, metric.x) * 3.0 + radius * 4.2)
        * gatheringField
        * uApproach
        * 0.004
        * planetProtection;

      // Several asynchronous life events move energy through selected texture zones.
      float lifeGrowth = 0.0;
      float lifeGrowthTip = 0.0;
      float lifeDecay = 0.0;
      float lifeDecayEdge = 0.0;
      float lifeResidue = 0.0;
      float lifeTransfer = 0.0;
      float lifeTransferTrail = 0.0;
      vec2 lifeDeformation = vec2(0.0);

      for (int i = 0; i < 3; i++) {
        vec4 lifeA = uLifeA[i];
        vec4 lifeB = uLifeB[i];
        float lifeProgress = clamp(lifeA.z, 0.0, 1.0);
        float lifeEnergy = lifeB.z;
        float growthKind = step(0.5, lifeA.w);
        float decayKind = 1.0 - step(-0.5, lifeA.w);
        float transferKind = max(0.0, 1.0 - growthKind - decayKind);
        vec2 lifeOrigin = vec2(lifeA.x * screenAspect, -lifeA.y);
        vec2 lifeDirection = normalize(vec2(lifeB.x, -lifeB.y) + vec2(0.00001));
        vec2 lifeNormal = vec2(-lifeDirection.y, lifeDirection.x);
        vec2 lifeDelta = metric - lifeOrigin;
        float lifeAlong = dot(lifeDelta, lifeDirection);
        float lifeAcross = dot(lifeDelta, lifeNormal);
        float seedPhase = fract(
          lifeB.w * 1.731
          + lifeA.x * 4.13
          + lifeA.y * 7.17
        );
        float branchTexture = 0.54
          + sin(lifeAcross * 58.0 + lifeAlong * 19.0 + seedPhase * 18.0) * 0.43;
        float branchGate = smoothstep(0.22, 0.76, branchTexture);
        float lifeAttack = smoothstep(0.0, 0.055, lifeProgress);
        float lifeRelease = 1.0 - smoothstep(0.84, 1.0, lifeProgress);
        float lifeEnvelope = lifeAttack * lifeRelease * lifeEnergy;

        // Growth has a visible advancing tip, a widening body, and a late split.
        float growthEase = smoothstep(0.02, 0.82, lifeProgress);
        float growthReach = mix(-0.10, 0.29, growthEase);
        float growthWidth = mix(0.070, 0.135, smoothstep(0.12, 0.75, lifeProgress));
        float growthLengthGate = smoothstep(-0.13, -0.035, lifeAlong)
          * (1.0 - smoothstep(growthReach - 0.040, growthReach + 0.030, lifeAlong));
        float growthAcrossGate = 1.0 - smoothstep(
          growthWidth * 0.24,
          growthWidth,
          abs(lifeAcross)
        );
        float growthBody = growthLengthGate
          * growthAcrossGate
          * (0.42 + branchGate * 0.58);
        float growthTipShape = length(vec2(
          (lifeAlong - growthReach) / 0.064,
          lifeAcross / max(0.025, growthWidth * 0.82)
        ));
        float growthTip = 1.0 - smoothstep(0.16, 1.0, growthTipShape);
        float branchSign = mix(-1.0, 1.0, step(0.5, seedPhase));
        float splitAmount = smoothstep(0.28, 0.76, lifeProgress) * 0.060;
        float growthBranchShape = length(vec2(
          (lifeAlong - growthReach * 0.88) / 0.078,
          (lifeAcross - branchSign * splitAmount) / 0.058
        ));
        float growthBranchTip = (1.0 - smoothstep(0.18, 1.0, growthBranchShape))
          * smoothstep(0.24, 0.56, lifeProgress);
        float growthField = max(
          growthBody,
          max(growthTip, growthBranchTip * 0.78)
        ) * lifeEnvelope * growthKind;

        lifeGrowth += growthField;
        lifeGrowthTip += max(growthTip, growthBranchTip)
          * lifeEnvelope
          * growthKind;
        lifeDeformation += lifeDirection
          * (growthBody * 0.020 + growthTip * 0.054 + growthBranchTip * 0.038)
          * lifeEnvelope
          * growthKind;
        lifeDeformation += lifeNormal
          * sin(lifeAlong * 33.0 - lifeAcross * 19.0 + seedPhase * 11.0)
          * (growthBody * 0.012 + growthBranchTip * 0.021)
          * lifeEnvelope
          * growthKind;

        // Decay visibly retreats, fractures, and leaves a soft residue behind.
        float decayEase = smoothstep(0.04, 0.88, lifeProgress);
        float decayReach = mix(0.27, -0.08, decayEase);
        float decayWidth = mix(0.145, 0.085, decayEase);
        float decayLengthGate = smoothstep(-0.13, -0.035, lifeAlong)
          * (1.0 - smoothstep(decayReach - 0.040, decayReach + 0.035, lifeAlong));
        float decayAcrossGate = 1.0 - smoothstep(
          decayWidth * 0.22,
          decayWidth,
          abs(lifeAcross)
        );
        float breakup = smoothstep(0.24, 0.90, lifeProgress);
        float decayFragments = mix(
          1.0,
          smoothstep(0.30, 0.73, branchTexture),
          breakup
        );
        float decayBody = decayLengthGate
          * decayAcrossGate
          * decayFragments;
        float decayFrontShape = length(vec2(
          (lifeAlong - decayReach) / 0.074,
          lifeAcross / max(0.025, decayWidth * 0.92)
        ));
        float decayFront = (1.0 - smoothstep(0.18, 1.0, decayFrontShape))
          * decayFragments;
        float decayField = max(decayBody, decayFront * 0.88)
          * lifeEnvelope
          * decayKind;
        float residueShape = 1.0 - smoothstep(
          0.34,
          1.0,
          length(vec2((lifeAlong - 0.03) / 0.30, lifeAcross / 0.19))
        );

        lifeDecay += decayField;
        lifeDecayEdge += decayFront
          * (0.36 + decayFragments * 0.64)
          * lifeEnvelope
          * decayKind;
        lifeResidue += residueShape
          * (0.38 + branchGate * 0.62)
          * smoothstep(0.22, 0.58, lifeProgress)
          * lifeRelease
          * lifeEnergy
          * decayKind
          * 0.82;
        lifeDeformation -= lifeDirection
          * (decayBody * 0.020 + decayFront * 0.040)
          * lifeEnvelope
          * decayKind;
        lifeDeformation += lifeNormal
          * sin(lifeAlong * 38.0 - lifeAcross * 27.0 + seedPhase * 13.0)
          * decayField
          * 0.023;

        // The third channel carries residue from the decaying zone toward growth.
        float transferReach = clamp(lifeB.w, 0.48, 1.45);
        float transferEase = 1.0 - pow(
          1.0 - smoothstep(0.02, 0.92, lifeProgress),
          2.0
        );
        float transferTravel = mix(-0.055, transferReach, transferEase);
        float transferWidth = mix(0.078, 0.128, lifeProgress);
        float transferHeadShape = length(vec2(
          (lifeAlong - transferTravel) / 0.078,
          lifeAcross / transferWidth
        ));
        float transferHead = 1.0 - smoothstep(0.16, 1.0, transferHeadShape);
        float transferTailLength = mix(0.12, 0.34, lifeProgress);
        float transferTail = smoothstep(
          transferTravel - transferTailLength,
          transferTravel - 0.035,
          lifeAlong
        ) * (1.0 - smoothstep(
          transferTravel - 0.020,
          transferTravel + 0.025,
          lifeAlong
        ));
        transferTail *= 1.0 - smoothstep(
          transferWidth * 0.18,
          transferWidth * 1.18,
          abs(lifeAcross)
        );
        transferTail *= 0.34 + branchGate * 0.66;
        float transferField = (transferHead * 0.94 + transferTail * 0.72)
          * lifeEnvelope
          * transferKind;

        lifeTransfer += transferField;
        lifeTransferTrail += transferTail
          * lifeEnvelope
          * transferKind;
        lifeDeformation += lifeDirection
          * transferHead
          * lifeEnvelope
          * transferKind
          * 0.039;
        lifeDeformation += lifeNormal
          * sin(lifeAlong * 29.0 + seedPhase * 16.0)
          * transferTail
          * lifeEnvelope
          * transferKind
          * 0.014;
      }

      deformation += lifeDeformation
        * outerAnchor
        * planetProtection
        * uMotion;

      vec2 pointerMetric = vec2(uPointerPx.x, -uPointerPx.y)
        * 2.0 / max(1.0, uResolution.y);
      vec2 towardPointer = pointerMetric - metric;
      float pointerDistance = length(towardPointer);
      float localInterest = 1.0 - smoothstep(0.06, 0.73, pointerDistance);
      float curiosityField = localInterest * tissueResponse * uStudy;
      deformation += towardPointer / max(pointerDistance, 0.0001)
        * curiosityField
        * 0.042
        * planetProtection;

      // Immediate pointer pressure: a narrow front, sideways refraction, and a long wake.
      vec2 flowDirection = normalize(vec2(uFlow.x, -uFlow.y) + vec2(0.00001));
      vec2 flowNormal = vec2(-flowDirection.y, flowDirection.x);
      vec2 flowDeltaPx = (metric - pointerMetric) * max(1.0, uResolution.y) * 0.5;
      float flowAlong = dot(flowDeltaPx, flowDirection);
      float flowAcross = dot(flowDeltaPx, flowNormal);
      float flowSpeed = length(uFlow.xy);
      float speedBlend = smoothstep(120.0, 980.0, flowSpeed);
      float flowRadius = mix(174.0, 92.0, speedBlend);
      float wakeLength = mix(155.0, 350.0, speedBlend);
      float coreDistance = length(vec2(
        flowAlong / max(1.0, flowRadius * 0.82),
        flowAcross / max(1.0, flowRadius)
      ));
      float flowCore = 1.0 - smoothstep(0.18, 1.0, coreDistance);
      float frontPressure = flowCore
        * smoothstep(-flowRadius * 0.18, flowRadius * 0.16, flowAlong)
        * (1.0 - smoothstep(flowRadius * 0.16, flowRadius * 0.92, flowAlong));
      float sideRefraction = flowCore
        * (1.0 - smoothstep(0.0, flowRadius, abs(flowAcross)))
        * (1.0 - frontPressure * 0.45);
      float wakeBody = smoothstep(-wakeLength, -flowRadius * 0.08, flowAlong)
        * (1.0 - smoothstep(-flowRadius * 0.08, flowRadius * 0.16, flowAlong))
        * (1.0 - smoothstep(flowRadius * 0.22, flowRadius, abs(flowAcross)));
      float wakeFilament = 0.64 + 0.36 * sin(
        flowAcross * 0.052
        - flowAlong * 0.018
        + uTime * 0.72
      );
      float flowDisplacementPx = mix(16.0, 7.0, speedBlend) * uFlow.z;
      vec2 flowDeformation = flowDirection
        * frontPressure
        * flowDisplacementPx;
      flowDeformation += flowNormal
        * sign(flowAcross)
        * sideRefraction
        * flowDisplacementPx
        * 0.58;
      flowDeformation += flowNormal
        * wakeBody
        * wakeFilament
        * flowDisplacementPx
        * 0.42;
      flowDeformation -= flowDirection
        * wakeBody
        * flowDisplacementPx
        * 0.18;
      deformation += flowDeformation
        * 2.0 / max(1.0, uResolution.y)
        * outerAnchor
        * planetProtection
        * uMotion;

      // Persistent wave packets finish their own lives and can overlap.
      float waveFrontAccum = 0.0;
      float waveShadowAccum = 0.0;
      vec2 waveDeformation = vec2(0.0);

      for (int i = 0; i < 3; i++) {
        vec4 waveA = uWaveA[i];
        vec4 waveB = uWaveB[i];
        float waveProgress = clamp(waveA.z, 0.0, 1.0);
        float waveEnergy = waveA.w;
        vec2 waveOrigin = vec2(waveA.x, -waveA.y)
          * 2.0 / max(1.0, uResolution.y);
        vec2 waveDeltaPx = (metric - waveOrigin) * max(1.0, uResolution.y) * 0.5;
        vec2 waveDirection = normalize(vec2(waveB.x, -waveB.y) + vec2(0.00001));
        vec2 waveNormal = vec2(-waveDirection.y, waveDirection.x);
        float waveAlong = dot(waveDeltaPx, waveDirection);
        float waveAcross = dot(waveDeltaPx, waveNormal);
        float directionBias = mix(0.88, 0.70, smoothstep(0.0, waveB.z, max(0.0, waveAlong)));
        float waveAngle = atan(waveAcross, waveAlong);
        float irregularDistance = length(vec2(
          waveAlong * directionBias,
          waveAcross * (1.04 + sin(waveAngle * 3.0 + waveB.w * 9.0) * 0.10)
        ));
        irregularDistance += sin(
          waveAngle * 5.0
          + irregularDistance * 0.025
          + waveB.w * 14.0
        ) * 9.0;
        float travelEase = 1.0 - pow(1.0 - waveProgress, 2.15);
        float waveRadiusPx = mix(10.0, waveB.z, travelEase);
        float waveWidthPx = mix(18.0, 66.0, waveProgress);
        float waveFront = 1.0 - smoothstep(
          waveWidthPx * 0.24,
          waveWidthPx,
          abs(irregularDistance - waveRadiusPx)
        );
        float waveBranches = 0.54
          + sin(waveAngle * 4.5 + irregularDistance * 0.031 + waveB.w * 17.0) * 0.43;
        float waveBranchGate = smoothstep(0.22, 0.76, waveBranches);
        float waveAttack = smoothstep(0.0, 0.055, waveProgress);
        float waveRelease = 1.0 - smoothstep(0.48, 1.0, waveProgress);
        float waveBreakup = smoothstep(0.58, 0.94, waveProgress);
        float fragmentGate = mix(
          1.0,
          smoothstep(0.34, 0.72, waveBranches),
          waveBreakup
        );
        float waveEnvelope = waveEnergy * waveAttack * waveRelease;
        float waveField = waveFront
          * (0.26 + waveBranchGate * 0.74)
          * fragmentGate
          * waveEnvelope;
        float waveShadow = 1.0 - smoothstep(
          waveWidthPx * 0.32,
          waveWidthPx * 1.25,
          abs(irregularDistance - max(0.0, waveRadiusPx - waveWidthPx * 1.08))
        );
        waveShadow *= (0.20 + waveBranchGate * 0.80) * waveEnvelope;

        vec2 waveRadial = waveDeltaPx / max(length(waveDeltaPx), 0.0001);
        waveDeformation -= waveRadial
          * waveField
          * mix(11.0, 4.0, waveProgress);
        waveDeformation += waveNormal
          * sin(waveAngle * 3.0 + waveB.w * 12.0)
          * waveField
          * mix(4.8, 2.0, waveProgress);
        waveFrontAccum += waveField;
        waveShadowAccum += waveShadow;
      }

      deformation += waveDeformation
        * 2.0 / max(1.0, uResolution.y)
        * tissueResponse
        * planetProtection
        * uMotion;

      vec2 planetDrift = vec2(
        sin(uTime * 0.027 + baseSourceUv.y * 13.0),
        cos(uTime * 0.021 + baseSourceUv.x * 11.0)
      ) * 0.0017 * planetNeighborhood * uMotion;

      deformation *= outerAnchor;
      deformation += planetDrift;
      deformation *= uMotion;

      vec2 screenWarp = vec2(
        deformation.x / max(0.001, screenAspect),
        deformation.y
      ) * 0.5;
      vec2 sourceUv = coverUv(narrativeUv - screenWarp);
      sourceUv = clamp(sourceUv, vec2(0.001), vec2(0.999));

      vec4 source = texture2D(uTexture, sourceUv);
      vec2 texel = 1.0 / max(uImageSize, vec2(1.0));
      vec3 north = texture2D(uTexture, sourceUv + vec2(0.0, texel.y * 1.7)).rgb;
      vec3 south = texture2D(uTexture, sourceUv - vec2(0.0, texel.y * 1.7)).rgb;
      vec3 east = texture2D(uTexture, sourceUv + vec2(texel.x * 1.7, 0.0)).rgb;
      vec3 west = texture2D(uTexture, sourceUv - vec2(texel.x * 1.7, 0.0)).rgb;
      vec3 soft = (north + south + east + west) * 0.25;

      float sourceLight = luminance(source.rgb);
      float softLight = luminance(soft);
      float filamentRidge = max(sourceLight - softLight, 0.0);
      float veil = max(softLight - sourceLight, 0.0);

      vec3 color = source.rgb;
      color = mix(color, soft, veil * 0.07);

      float signalTexture = smoothstep(0.035, 0.36, softLight + filamentRidge * 2.1);
      float growthTexture = lifeGrowth
        * signalTexture
        * (0.50 + filamentRidge * 4.0);
      float growthTipTexture = lifeGrowthTip
        * smoothstep(0.022, 0.31, softLight + filamentRidge * 2.6);
      float decayTexture = lifeDecay
        * signalTexture
        * (0.56 + veil * 3.0);
      float decayEdgeTexture = lifeDecayEdge
        * smoothstep(0.020, 0.31, softLight + filamentRidge * 2.1);
      float residueTexture = lifeResidue
        * smoothstep(0.018, 0.30, softLight + filamentRidge * 1.4);
      float transferTexture = lifeTransfer
        * signalTexture
        * (0.48 + filamentRidge * 3.6);
      float transferTrailTexture = lifeTransferTrail
        * smoothstep(0.018, 0.28, softLight + filamentRidge * 1.7);
      float fogAmount = clamp(
        decayTexture * 0.39 + residueTexture * 0.27,
        0.0,
        0.48
      );
      color = mix(color, soft, fogAmount);
      color *= 1.0
        + growthTexture * 0.58
        + growthTipTexture * 0.16
        - decayTexture * 0.34
        - residueTexture * 0.11
        - transferTrailTexture * 0.045;
      color += vec3(0.58, 0.63, 0.70)
        * filamentRidge
        * (0.10 + growthTexture * 0.82 + growthTipTexture * 0.38);
      color += vec3(0.42, 0.47, 0.52)
        * decayEdgeTexture
        * 0.20;
      color += vec3(0.52, 0.59, 0.67)
        * transferTexture
        * 0.48;

      float diffusionGlow = waveFrontAccum * signalTexture;
      float diffusionShadow = waveShadowAccum * signalTexture;
      float localRecognition = localInterest
        * signalTexture
        * uStudy;
      float flowSheen = (
        frontPressure * 0.74
        + sideRefraction * 0.26
        + wakeBody * wakeFilament * 0.20
      ) * uFlow.z * signalTexture;
      color *= 1.0 - diffusionShadow * 0.085;
      color += vec3(0.56, 0.63, 0.71)
        * diffusionGlow
        * 0.42;
      color += vec3(0.49, 0.55, 0.63)
        * localRecognition
        * 0.085;
      color += vec3(0.52, 0.59, 0.66)
        * flowSheen
        * 0.16;
      color += vec3(0.57, 0.62, 0.68)
        * filamentRidge
        * pupilEdge
        * uPupilDilation
        * 0.16;

      float outerFocus = smoothstep(0.92, 1.72, radius);
      color *= 1.0 - outerFocus * uApproach * 0.038;

      vec2 moteGrid = vec2(214.0, 121.0);
      vec2 moteUv = sourceUv
        + vec2(uTime * 0.000035, sin(uTime * 0.041) * 0.00016)
        * uMotion;
      vec2 moteCell = floor(moteUv * moteGrid);
      vec2 moteLocal = fract(moteUv * moteGrid);
      vec2 moteCenter = vec2(
        0.2 + hash21(moteCell + 7.31) * 0.6,
        0.2 + hash21(moteCell + 29.17) * 0.6
      );
      float moteGate = step(0.9915, hash21(moteCell + 91.73));
      float moteBody = 1.0 - smoothstep(0.018, 0.105, length(moteLocal - moteCenter));
      float moteTwinkleLive = 0.58 + 0.42 * sin(
        uTime * (0.27 + hash21(moteCell + 51.9) * 0.36)
        + hash21(moteCell) * 6.28318
      );
      float moteTwinkle = mix(0.72, moteTwinkleLive, uMotion);
      float inhabited = smoothstep(0.028, 0.24, softLight + filamentRidge * 1.7);
      color += vec3(0.72, 0.76, 0.79)
        * moteBody
        * moteGate
        * moteTwinkle
        * inhabited
        * 0.34;

      float heldStill = uStudy
        * localInterest
        * tissueResponse
        * smoothstep(0.02, 0.32, sourceLight)
        * uMotion;
      color *= 1.0 - heldStill * 0.026;

      // Opening light is recovered from the highlights down into the blacks.
      // This keeps the pupil in darkness while the filament structure develops.
      float revealThreshold = mix(0.46, -0.02, pow(revealProgress, 0.72));
      float revealWidth = mix(0.040, 0.18, revealProgress);
      float blackLevelGate = smoothstep(
        revealThreshold,
        revealThreshold + revealWidth,
        luminance(color)
      );
      blackLevelGate = mix(
        blackLevelGate,
        1.0,
        smoothstep(0.72, 1.0, revealProgress)
      );
      color *= smoothstep(0.0, 0.045, revealProgress) * blackLevelGate;
      color *= 1.0 - smoothstep(0.90, 1.0, max(zoomProgress, entryProgress));

      gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
    }
  `;

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Unable to load nebula source: ${source}`));
      image.src = source;
    });
  }

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || 'Unknown shader compilation error';
      gl.deleteShader(shader);
      throw new Error(message);
    }

    return shader;
  }

  function createProgram(gl) {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) || 'Unknown program link error';
      gl.deleteProgram(program);
      throw new Error(message);
    }

    return program;
  }

  class LivingNebula {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.reducedMotion = Boolean(options.reducedMotion);
      this.onContextLost = typeof options.onContextLost === 'function'
        ? options.onContextLost
        : null;
      this.onContextRestored = typeof options.onContextRestored === 'function'
        ? options.onContextRestored
        : null;
      this.gl = null;
      this.program = null;
      this.buffer = null;
      this.texture = null;
      this.ready = false;
      this.lost = false;
      this.cssWidth = 1;
      this.cssHeight = 1;
      this.dpr = 1;
      this.imageWidth = IMAGE_WIDTH;
      this.imageHeight = IMAGE_HEIGHT;
      this.emptyLifeA = new Float32Array(12);
      this.emptyLifeB = new Float32Array(12);
      this.emptyWaveA = new Float32Array(12);
      this.emptyWaveB = new Float32Array(12);

      this.handleContextLost = (event) => {
        event.preventDefault();
        this.lost = true;
        if (this.onContextLost) this.onContextLost();
      };
      this.handleContextRestored = () => {
        if (this.onContextRestored) {
          this.onContextRestored();
        } else {
          window.location.reload();
        }
      };
    }

    async init(source) {
      const gl = this.canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
      });

      if (!gl) throw new Error('WebGL is unavailable');
      this.gl = gl;

      const image = await loadImage(source);
      this.imageWidth = image.naturalWidth || IMAGE_WIDTH;
      this.imageHeight = image.naturalHeight || IMAGE_HEIGHT;
      this.program = createProgram(gl);
      this.locations = this.getLocations();
      this.buffer = gl.createBuffer();

      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
          -1, -1,
          1, -1,
          -1, 1,
          1, 1,
        ]),
        gl.STATIC_DRAW
      );

      this.texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
      );

      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      gl.clearColor(0, 0, 0, 1);

      this.canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
      this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);

      this.resize(true);
      this.ready = true;
      return this;
    }

    getLocations() {
      const gl = this.gl;
      const program = this.program;
      return {
        position: gl.getAttribLocation(program, 'aPosition'),
        texture: gl.getUniformLocation(program, 'uTexture'),
        resolution: gl.getUniformLocation(program, 'uResolution'),
        imageSize: gl.getUniformLocation(program, 'uImageSize'),
        gazePx: gl.getUniformLocation(program, 'uGazePx'),
        pointerPx: gl.getUniformLocation(program, 'uPointerPx'),
        time: gl.getUniformLocation(program, 'uTime'),
        awareness: gl.getUniformLocation(program, 'uAwareness'),
        study: gl.getUniformLocation(program, 'uStudy'),
        approach: gl.getUniformLocation(program, 'uApproach'),
        pupilDilation: gl.getUniformLocation(program, 'uPupilDilation'),
        narrative: gl.getUniformLocation(program, 'uNarrative'),
        flow: gl.getUniformLocation(program, 'uFlow'),
        lifeA: gl.getUniformLocation(program, 'uLifeA[0]'),
        lifeB: gl.getUniformLocation(program, 'uLifeB[0]'),
        waveA: gl.getUniformLocation(program, 'uWaveA[0]'),
        waveB: gl.getUniformLocation(program, 'uWaveB[0]'),
        motion: gl.getUniformLocation(program, 'uMotion'),
      };
    }

    resize(force = false) {
      const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
      const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
      const compact = Math.min(width, height) < 700;
      const dprLimit = compact ? 1.15 : 1.25;
      const dpr = Math.min(window.devicePixelRatio || 1, dprLimit);
      const pixelWidth = Math.round(width * dpr);
      const pixelHeight = Math.round(height * dpr);

      if (
        !force
        && pixelWidth === this.canvas.width
        && pixelHeight === this.canvas.height
      ) return;

      this.cssWidth = width;
      this.cssHeight = height;
      this.dpr = dpr;
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
      this.gl.viewport(0, 0, pixelWidth, pixelHeight);
    }

    render(time, state = {}) {
      if (!this.ready || this.lost) return;
      const gl = this.gl;
      const locations = this.locations;

      this.resize();
      gl.useProgram(this.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.enableVertexAttribArray(locations.position);
      gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.uniform1i(locations.texture, 0);
      gl.uniform2f(locations.resolution, this.cssWidth, this.cssHeight);
      gl.uniform2f(locations.imageSize, this.imageWidth, this.imageHeight);
      gl.uniform2f(locations.gazePx, state.gazeX || 0, state.gazeY || 0);
      gl.uniform2f(locations.pointerPx, state.pointerX || 0, state.pointerY || 0);
      gl.uniform1f(locations.time, time);
      gl.uniform1f(locations.awareness, state.awareness || 0);
      gl.uniform1f(locations.study, state.study || 0);
      gl.uniform1f(locations.approach, state.approach || 0);
      gl.uniform1f(locations.pupilDilation, state.pupilDilation || 0);
      gl.uniform3f(
        locations.narrative,
        state.reveal || 0,
        state.zoom || 0,
        state.entry || 0
      );
      gl.uniform4f(
        locations.flow,
        state.flowVelocityX || 0,
        state.flowVelocityY || 0,
        state.disturbance || 0,
        state.stillness || 0
      );
      gl.uniform4fv(locations.lifeA, state.lifeA || this.emptyLifeA);
      gl.uniform4fv(locations.lifeB, state.lifeB || this.emptyLifeB);
      gl.uniform4fv(locations.waveA, state.waveA || this.emptyWaveA);
      gl.uniform4fv(locations.waveB, state.waveB || this.emptyWaveB);
      gl.uniform1f(locations.motion, this.reducedMotion ? 0 : 1);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    destroy() {
      if (!this.gl) return;
      const gl = this.gl;
      this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
      this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
      if (this.buffer) gl.deleteBuffer(this.buffer);
      if (this.texture) gl.deleteTexture(this.texture);
      if (this.program) gl.deleteProgram(this.program);
      this.ready = false;
    }
  }

  window.LivingNebula = LivingNebula;
})();

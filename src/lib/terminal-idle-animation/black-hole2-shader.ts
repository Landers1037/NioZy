import blackholeGlsl from '@/components/terminal/idle-animation/blackhole.glsl?raw'

const WEBGL_HEADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_terminal;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_center;
uniform float u_sz;
uniform float u_effectRadiusPx;
#define iChannel0 u_terminal
#define iResolution u_resolution
#define iTime u_time
#define iDate vec4(0.0, 0.0, 0.0, 0.0)
#define iCurrentCursorColor vec4(0.0)
#define iPreviousCursorColor vec4(0.0)
#define iTimeCursorChange 0.0
`

const WEBGL_FOOTER = `
void main() {
  // Ghostty fragCoord 为 y 向下；WebGL v_uv 为 y 向上，需翻转
  vec2 fragCoord = vec2(v_uv.x, 1.0 - v_uv.y) * u_resolution;
  vec2 uv = fragCoord / u_resolution;
  vec2 deltaPx = (uv - u_center) * u_resolution;
  float distPx = length(deltaPx);
  // 只在 ~200px 效果区内绘制，其余 discard 露出底层终端
  if (distPx > u_effectRadiusPx) discard;

  mainImage(outColor, fragCoord);

  float fade = 1.0 - smoothstep(u_effectRadiusPx * 0.86, u_effectRadiusPx, distPx);
  outColor.a *= fade;
}
`

/** 将 Ghostty blackhole.glsl 适配为 xterm 闲置动画可用的 WebGL2 fragment shader */
export function buildBlackHole2FragmentShader(): string {
  let source = blackholeGlsl

  source = source.replace('#define MODE_DEMO     2', '#define MODE_DEMO     2\n#define MODE_IDLE     3')
  source = source.replace('#define SIZE_MODE MODE_TOKENS', '#define SIZE_MODE MODE_IDLE')

  source = source.replace(/const float DISK_GAIN\s+=\s+[\d.]+;/, 'const float DISK_GAIN     = 0.0000;')
  source = source.replace(/const float STAR_GAIN\s+=\s+[\d.]+;/, 'const float STAR_GAIN     = 0.0000;')
  source = source.replace(/const float DISK_OPACITY\s+=\s+[\d.]+;/, 'const float DISK_OPACITY  = 0.0000;')
  source = source.replace(/const float WORK_AREA\s+=\s+[\d.]+;/, 'const float WORK_AREA     = 0.0000;')
  source = source.replace(/#define N_STEPS 48/, '#define N_STEPS 32')

  source = source.replace(
    /float I, sz;\s*\n\s*vec2\s+center;\s*\n\s*if \(SIZE_MODE == MODE_POMODORO\) \{[\s\S]*?\} else \{[\s\S]*?\}\s*\n\s*float vis = smoothstep\(0\.0, 0\.10, I\);/,
    `float I = 1.0;
    float sz = u_sz;
    vec2 center = u_center;
    float vis = 1.0;`,
  )

  // geodesic 路径：修复非捕获光线的终端采样
  // 原始 d.z < -0.05 判断会让大多数偏横逃逸光线得到 bg=0（黑色）
  // 改为：d.z < 0 时正常做透镜投影采样，d.z >= 0 时回退到未扭曲位置
  source = source.replace(
    /if \(d\.z < -0\.05\) \{[\s\S]*?bg \+= texture\(iChannel0, suv\)\.rgb \* toward;\s*\}/,
    `{
            if (d.z < -1e-4) {
                // 光线射向 sky 平面：做引力透镜投影
                float toward = smoothstep(-0.05, -0.40, d.z);
                float tpl = (-LENS_DEPTH - x.z) / d.z;
                vec3  hp  = x + d * tpl;
                vec2  q   = rot(hp.xy, -L.roll) / W;
                vec2  sp  = vec2(q.x, -q.y);
                vec2  suv = mirrorUV(center + (p + (sp - p) * window * shield) / vec2(aspect, 1.0));
                // toward=1 时全透镜，toward=0 时回退未扭曲，避免 bg 变全黑
                bg += mix(texture(iChannel0, uv).rgb, texture(iChannel0, suv).rgb, toward);
            } else {
                // 光线向相机方向逃逸：直接采样当前像素对应终端内容
                bg += texture(iChannel0, uv).rgb;
            }
        }`,
  )

  // 恢复原始捕获判定（< 4.0）：接近光子球但超出积分步数的光线标为捕获
  // 不改动此值，避免 photon sphere 附近出现随机噪点

  return `${WEBGL_HEADER}\n${source}\n${WEBGL_FOOTER}`
}

let cachedShader: string | null = null

/** Ghostty blackhole.glsl 中 HOLE_RADIUS 的实际值（与源文件保持同步） */
export const GHOSTTY_HOLE_RADIUS = 0.02

export function getBlackHole2FragmentShader(): string {
  cachedShader = buildBlackHole2FragmentShader()
  return cachedShader
}

/** sz 使 HOLE_RADIUS * sz ≈ 核心半径占屏高比例 */
export function computeBlackHole2SizeScale(coreRadiusPx: number, screenHeightPx: number): number {
  const targetFraction = coreRadiusPx / Math.max(screenHeightPx, 1)
  return targetFraction / GHOSTTY_HOLE_RADIUS
}

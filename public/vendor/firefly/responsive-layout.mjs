// Adapted from CuteLeaf/Firefly, MIT. Commit 91cbbefe53716e70b77ca9c41e27af10f5b27cab.
// Change: dependency-free ESM subset, dropping unrelated config imports.
const SIDEBAR_WIDTH="17.5rem";
const SIDEBAR_TRACK="var(--grid-sidebar-width)";
/** computeGridColumns 的输入，SSR 与客户端共用同一组值 */
                                   
	                 
	                                    
	                                
	                               
	                    
	                        
	                         
	                                         
	                               
 

/** #main-grid 的列几何，由 gridColumnVarsToStyle 序列化 */
                                 
	                    
	                    
	                                         
	                                         
	                                          
	                                          
	                                                            
	                               
	                                        
	                             
	                             
 

/** 按左右两侧是否占列生成轨道串 */
function trackSegments(left         , right         )         {
	if (left && right) return `${SIDEBAR_TRACK} 1fr ${SIDEBAR_TRACK}`;
	if (left) return `${SIDEBAR_TRACK} 1fr`;
	if (right) return `1fr ${SIDEBAR_TRACK}`;
	return "1fr";
}

/**
 * 计算 #main-grid 的列几何（SSR 与客户端共用的唯一真源）。
 * 侧栏包裹层是 display:contents，真正的 grid item 是内层元素，按 DOM 顺序自动放置即可。
 */
export function computeGridColumns(input                  )                 {
	// 整站禁用，或文章页整体隐藏侧栏
	const sidebarActive =
		input.enabled && !(input.isPostPage && input.hideSidebarOnPostPage);

	const leftIn =
		sidebarActive && input.hasLeftWidgets && input.position !== "right";
	const rightIn =
		sidebarActive && input.hasRightWidgets && input.position !== "left";

	// 平板端：position 为 both 时只显示 tabletSidebar 指定的那一侧
	const mdLeft =
		leftIn &&
		(input.position === "left" ||
			(input.position === "both" && input.tabletSidebar === "left"));
	const mdRight =
		rightIn &&
		(input.position === "right" ||
			(input.position === "both" && input.tabletSidebar === "right"));

	// 侧栏已启用但本断点无侧栏列 → 内容栏按比例收窄；比例钳到 [0,1]，1 即不收窄
	// 闸门用 enabled 而非 sidebarActive：enable: false 时仍铺满。md 与 xl 需各自判定
	const raw = input.noSidebarContentWidth;
	const ratio =
		raw == null || !Number.isFinite(raw) ? 1 : Math.min(1, Math.max(0, raw));
	const ratioMd = input.enabled && !mdLeft && !mdRight ? ratio : 1;
	const ratioXl = input.enabled && !leftIn && !rightIn ? ratio : 1;

	return {
		"--cols-md": trackSegments(mdLeft, mdRight),
		"--cols-xl": trackSegments(leftIn, rightIn),
		"--left-display-md": mdLeft ? "contents" : "none",
		"--left-display-xl": leftIn ? "contents" : "none",
		"--right-display-md": mdRight ? "contents" : "none",
		"--right-display-xl": rightIn ? "contents" : "none",
		"--grid-sidebar-width": SIDEBAR_WIDTH,
		"--content-ratio-md": ratioMd,
		"--content-ratio-xl": ratioXl,
	};
}

/** 序列化为 inline style 属性值（自定义属性值含空格，不能用对象形式） */
export function gridColumnVarsToStyle(vars                )         {
	return Object.entries(vars)
		.map(([key, value]) => `${key}:${value}`)
		.join(";");
}

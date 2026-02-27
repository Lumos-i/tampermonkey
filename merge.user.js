// ==UserScript==
// @name         Dynamics Inline 标签优化（稳定增强版 v6）
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  检测并选择性合并 content 字段中被拆分的 inline 标签（显示原始切片）
// @author       zrq
// @match        https://*.dynamics.com/main.aspx*
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    /************** 等待 Xrm（最多 10 秒） **************/
    function waitForXrm(callback) {
        let retry = 0;
        const timer = setInterval(() => {
            retry++;
            console.log("等待 Xrm 第 " + retry + " 次");

            if (window.Xrm && Xrm.Page && Xrm.Page.getAttribute) {
                clearInterval(timer);
                callback();
            }

            if (retry > 20) {
                clearInterval(timer);
                console.error("等待 Xrm 超时");
            }

        }, 5000); // 10 秒
    }

    waitForXrm(init);

    /************** 主逻辑 **************/
    function init() {

        const attr = Xrm.Page.getAttribute("content");
        if (!attr) return;

        const html = attr.getValue();
        if (!html) return;

        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = html;

        const inlineTags = ["STRONG","B","EM","SPAN","U","MARK","SMALL","SUB","SUP"];

        function isInline(node) {
            return node &&
                node.nodeType === 1 &&
                inlineTags.includes(node.nodeName);
        }

        function isIgnorable(node) {
            if (!node) return false;

            if (node.nodeType === 3 && !node.textContent.trim()) return true;
            if (isInline(node) && !node.textContent.trim()) return true;

            return false;
        }

        function attrsEqual(a, b) {
            if (a.attributes.length !== b.attributes.length) return false;

            for (let i = 0; i < a.attributes.length; i++) {
                const attr = a.attributes[i];
                if (b.getAttribute(attr.name) !== attr.value) return false;
            }
            return true;
        }

        function canMerge(a, b) {
            return a &&
                   b &&
                   a.nodeName === b.nodeName &&
                   isInline(a) &&
                   attrsEqual(a, b);
        }

        let mergeGroups = [];

        function scan(node) {

            let child = node.firstChild;

            while (child) {

                if (isInline(child)) {

                    let group = [child];
                    let next = child.nextSibling;

                    while (next && isIgnorable(next)) {
                        next = next.nextSibling;
                    }

                    while (canMerge(child, next)) {

                        group.push(next);
                        next = next.nextSibling;

                        while (next && isIgnorable(next)) {
                            next = next.nextSibling;
                        }
                    }

                    if (group.length > 1) {
                        mergeGroups.push(group);
                    }
                }

                if (child.nodeType === 1) {
                    scan(child);
                }

                child = child.nextSibling;
            }
        }

        scan(tempDiv);

        if (mergeGroups.length === 0) {
            console.log("未发现可合并结构");
            return;
        }

        createPanel(mergeGroups, tempDiv, attr);
    }

    /************** UI 面板 **************/
    function createPanel(groups, tempDiv, attr) {

        const panel = document.createElement("div");

        Object.assign(panel.style, {
            position: "fixed",
            top: "60px",
            right: "20px",
            width: "420px",
            maxHeight: "500px",
            overflow: "auto",
            background: "#fff",
            border: "1px solid #ccc",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            zIndex: "999999",
            padding: "12px",
            fontSize: "12px",
            borderRadius: "6px"
        });

        panel.innerHTML = "<b>检测到可合并片段：</b><br><br>";

        groups.forEach((group, index) => {

            const id = "merge_group_" + index;

            const wrapper = document.createElement("div");
            wrapper.style.marginBottom = "12px";

            const title = document.createElement("div");
            title.innerHTML = `
                <label>
                    <input type="checkbox" id="${id}" checked>
                    &lt;${group[0].nodeName}&gt; （共 ${group.length} 片）
                </label>
            `;
            wrapper.appendChild(title);

            const preview = document.createElement("div");
            preview.style.marginTop = "6px";

            group.forEach((node, i) => {
                const span = document.createElement("span");
                span.textContent = node.textContent;
                span.style.display = "inline-block";
                span.style.padding = "2px 4px";
                span.style.margin = "2px";
                span.style.background = "#f5f5f5";
                span.style.border = "1px solid #ddd";
                span.style.borderRadius = "3px";
                span.title = node.outerHTML;
                preview.appendChild(span);
            });

            wrapper.appendChild(preview);
            panel.appendChild(wrapper);
        });

        const mergeBtn = document.createElement("button");
        mergeBtn.textContent = "执行合并";
        mergeBtn.style.marginRight = "10px";

        mergeBtn.onclick = function () {

            groups.forEach((group, index) => {

                const checkbox = document.getElementById("merge_group_" + index);
                if (!checkbox || !checkbox.checked) return;

                const first = group[0];

                for (let i = 1; i < group.length; i++) {
                    const current = group[i];
                    if (current.parentNode) {
                        while (current.firstChild) {
                            first.appendChild(current.firstChild);
                        }
                        current.parentNode.removeChild(current);
                    }
                }
            });

            attr.setValue(tempDiv.innerHTML);
            document.body.removeChild(panel);
            alert("合并完成，请手动保存记录");
        };

        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "取消";

        cancelBtn.onclick = function () {
            document.body.removeChild(panel);
        };

        panel.appendChild(mergeBtn);
        panel.appendChild(cancelBtn);

        document.body.appendChild(panel);
    }

})();

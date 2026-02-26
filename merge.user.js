// ==UserScript==
// @name         Dynamics Inline 标签优化检测
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  检测 content 字段中可合并的 inline 标签，提示用户是否修复
// @author       zrq
// @match        https://*.dynamics.com/main.aspx*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    console.log("Inline 优化脚本已加载");

    function waitForXrm(callback) {
        var check = setInterval(function () {
            if (window.Xrm && Xrm.Page && Xrm.Page.getAttribute) {
                clearInterval(check);
                callback();
            }
        }, 2000);
    }

    waitForXrm(function () {

        var attr = Xrm.Page.getAttribute("content");
        if (!attr) {
            console.warn("找不到字段 content");
            return;
        }

        var html = attr.getValue();
        if (!html) return;

        var tempDiv = document.createElement("div");
        tempDiv.innerHTML = html;

        function isIgnorableNode(node) {
            return node.nodeType === 3 && !node.textContent.trim();
        }

        function isInlineElement(node) {
            if (!node || node.nodeType !== 1) return false;

            const inlineTags = [
                "STRONG", "B", "EM",
                "SPAN", "U", "MARK", "SMALL",
                "SUB", "SUP"
            ];

            return inlineTags.includes(node.nodeName);
        }

        function attributesEqual(a, b) {
            if (a.attributes.length !== b.attributes.length) return false;

            for (let i = 0; i < a.attributes.length; i++) {
                let attrA = a.attributes[i];
                let attrB = b.getAttribute(attrA.name);
                if (attrB !== attrA.value) return false;
            }

            return true;
        }

        function canMerge(a, b) {
            if (!a || !b) return false;
            if (a.nodeName !== b.nodeName) return false;
            if (!isInlineElement(a)) return false;
            return attributesEqual(a, b);
        }

        function processNode(node) {

            let child = node.firstChild;
            let changed = false;

            while (child) {

                // 删除空 inline 标签
                if (isInlineElement(child) && !child.textContent.trim()) {
                    let toRemove = child;
                    child = child.nextSibling;
                    node.removeChild(toRemove);
                    changed = true;
                    continue;
                }

                if (isInlineElement(child)) {

                    let next = child.nextSibling;

                    // 删除空白文本节点
                    while (next && isIgnorableNode(next)) {
                        let toRemove = next;
                        next = next.nextSibling;
                        node.removeChild(toRemove);
                        changed = true;
                    }

                    if (canMerge(child, next)) {
                        child.innerHTML += next.innerHTML;
                        node.removeChild(next);
                        changed = true;
                        continue;
                    }
                }

                if (child.nodeType === 1) {
                    if (processNode(child)) {
                        changed = true;
                    }
                }

                child = child.nextSibling;
            }

            return changed;
        }

        var changed = processNode(tempDiv);

        if (!changed) {
            console.log("未发现可优化的 inline 标签");
            return;
        }

        console.log("发现可优化结构");

        if (!confirm("检测到可优化的 inline 标签结构，是否自动合并？")) {
            return;
        }

        var newHtml = tempDiv.innerHTML;

        attr.setValue(newHtml);

        alert("已完成 inline 合并，请手动保存记录");
    });

})();

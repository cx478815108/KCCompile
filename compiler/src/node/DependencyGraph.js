class Graph {
    constructor() {
        this.links = {};
        this.marks = {};
    }

    clearVisitInfo() {
        this.marks = {};
    }

    addEdge(from, to) {
        if (from && to) {
            if (!this.links[from.componentName]) {
                this.links[from.componentName] = [];
            }

            this.links[from.componentName].push(to);
            const list = this.links[to.componentName];
            if (list && list.length) {
                for (let node of list) {
                    if (node.componentName === from.componentName) {
                        console.error(`[Error]: ${from.componentName} 和 ${to.componentName} 循环依赖了❌❌❌`);
                        return false;
                    }
                }
            }

            return true;
        }
        return true;
    }

    visistGraph(startVertex, cb) {
        let queue = [];
        this.marks[startVertex.componentName] = true;
        queue.push(startVertex);

        while (queue.length > 0) {
            let v = queue.shift();
            cb && cb(v);
            const list = this.links[v.componentName];
            list && list.forEach((w) => {
                if (!this.marks[w.componentName]) {
                    this.marks[w.componentName] = true;
                    queue.push(w);
                }
            });
        }
    }
}

module.exports = Graph;
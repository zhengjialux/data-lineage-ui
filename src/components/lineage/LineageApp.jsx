import { 
    ReactFlowProvider, 
    ReactFlow, 
    Background
} from '@xyflow/react'
import { MAX_ZOOM_VALUE, MIN_ZOOM_VALUE } from './entity.enum'
import { nodeTypes, customEdges } from './lineageUtils'
import { useLineageProvider } from './LineageProvider'
import '@xyflow/react/dist/style.css';

const LineageApp = () => {
    const {
        edges,
        nodes,
        onInitReactFlow,
        onEdgesChange,
        onNodesChange,
        onNodeClick,
        onEdgeClick,
        onPaneClick
    } = useLineageProvider()

    return (
        <ReactFlowProvider>
            <ReactFlow
                // onlyRenderVisibleElements    // 优化项，表示只渲染和更新画布视图显示的节点和连接线
                deleteKeyCode={null}         // 不定义其他键代替删除，默认delete和backspace
                edgeTypes={customEdges}
                edges={edges}                // 连接线数据
                onEdgesChange={onEdgesChange}
                fitViewOptions={{            // 视图自动缩放、定位、平移的时候，附带的额外配置
                    padding: 48,             // 当点击自动放大到合适的大小时，保留padding 48的距离
                }}
                maxZoom={MAX_ZOOM_VALUE}     // 最大变焦（画布限制最大放大多少）
                minZoom={MIN_ZOOM_VALUE}     // 最小变焦（画布限制最小放小多少）
                nodeTypes={nodeTypes}
                nodes={nodes}                // 节点数据
                onNodesChange={onNodesChange}
                selectNodesOnDrag={false}    // 所有节点选择是否可拖动
                onInit={onInitReactFlow}     // viewport初始化事件
                // 节点点击事件
                onNodeClick={(_e, node) => {
                    onNodeClick(node);
                    _e.stopPropagation();
                }}
                // 连接线点击事件
                onEdgeClick={(_e, data) => {
                    onEdgeClick(data);
                    _e.stopPropagation();
                }}
                onPaneClick={onPaneClick}
            >
                <Background gap={12} size={1} />
            </ReactFlow>
        </ReactFlowProvider>
    )
}

export default LineageApp
import { useEffect, useState, createContext, useContext } from "react"
import { uniqWith, isEqual } from 'lodash'
import { 
  getChildMap, 
  getPaginatedChildMap, 
  createNodes, 
  createEdges, 
  getUpstreamDownstreamNodesEdges, 
  centerNodePosition,
  getClassifiedEdge,
  getAllTracedColumnEdge,
  getLayoutedElements,
  onLoad,
  getConnectedNodesEdges,
  getAllTracedNodes
} from './lineageUtils'
import { EntityLineageNodeType, EntityLineageDirection, EdgeTypeEnum } from './entity.enum'
import { useNodesState, useEdgesState } from '@xyflow/react'
import { getLineageDataByFQN } from '../../serviceApi/getLineageDataApi'
import { Drawer } from 'antd'

export const LineageContext = createContext({});

const LineageApp = ({ children }) => {
  // 血缘数据详情
  const [childMap, setChildMap] = useState({})
  // 血缘数据呈现对象
  const [entityLineage, setEntityLineage] = useState({})
  // 血缘节点连线布局数据
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  // 上下游归类
  const [upstreamDownstreamData, setUpstreamDownstreamData] = useState({
    downstreamEdges: [],
    upstreamEdges: [],
    downstreamNodes: [],
    upstreamNodes: [],
  });
  // reactflow 实例对象
  const [reactFlowInstance, setReactFlowInstance] = useState();
  // 当前选中的节点对象
  const [selectedNode, setSelectedNode] = useState({});
  // 当前触发的节点
  const [activeNode, setActiveNode] = useState();
  // 追溯有关系的关联字段
  const [tracedColumns, setTracedColumns] = useState([]);
  // 详情抽屉状态
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  // ----------------- 备用字段 -------------------
  // 是否显示字段列表
  const [expandAllColumns, setExpandAllColumns] = useState(true);  
  // 连接线关联的所有血缘字段
  const [columnsHavingLineage, setColumnsHavingLineage] = useState([]);
  // 追溯有关系的关联节点
  const [tracedNodes, setTracedNodes] = useState([]);
  // 选中的字段
  const [selectedColumn, setSelectedColumn] = useState('');
  // 血缘节点数量控制
  const [paginationData, setPaginationData] = useState({});
  // 选中的连接线
  const [selectedEdge, setSelectedEdge] = useState();
  // 血缘数量配置
  const [lineageConfig, setLineageConfig] = useState({
    upstreamDepth: 3,
    downstreamDepth: 3,
    nodesPerLayer: 50,
  });

  // 获取血缘数据
  useEffect(() => {
    getLineageDataByFQN(
      // {
      //   查询主表名 fqn: TEST-MySQL.data_test.cascade_connection_test.cdc_table
      //   血缘类型 type: table
      //   向上查询血缘层级 upstreamDepth: 3
      //   向下查询血缘层级 downstreamDepth: 3
      //   筛选域查询 query_filter: {"query":{"bool":{"must":[{"bool":{"should":[{"term":{"domain.displayName.keyword":"供应链-电饭煲产线"}}]}}]}}}
      //   查询已删除的 includeDeleted: false
      // }
    ).then(res => {
      handleLineageData(res)
    })
  }, [lineageConfig])

  const handleLineageData = (lineageData) => {
    const { entity, nodes, edges } = lineageData
    const fullyQualifiedName = entity.fullyQualifiedName
    // 整合全量节点
    const nodeAll = uniqWith([entity, ...nodes].filter(Boolean), isEqual)
    // 对节点进行处理
    const { map } = getChildMap({...lineageData, nodes: nodeAll}, fullyQualifiedName)
    setChildMap(map)

    const { nodes: newNodes, edges: newEdges } = getPaginatedChildMap(
      {...lineageData, nodes: nodeAll},
      map,
      {},
      lineageConfig?.nodesPerLayer ?? 50
    )

    // 保存最终血缘关系对象
    setEntityLineage({
      ...lineageData,
      nodes: newNodes,
      edges: [...(edges ?? []), ...newEdges ]
    })
  }

  // 插件初始化布局
  useEffect(() => {
    if (reactFlowInstance?.viewportInitialized) {
      repositionLayout(true); // Activate the root node
    }
  }, [reactFlowInstance?.viewportInitialized]);

  // 重新渲染布局位置
  const repositionLayout = (activateNode = false) => {
    const { node, edge } = getLayoutedElements(
      {
        node: nodes,
        edge: edges,
      },
      EntityLineageDirection.LEFT_RIGHT,
      true,
      expandAllColumns,
      columnsHavingLineage
    );
    setNodes(node);
    setEdges(edge);
    const rootNode = node.find((n) => n.data.isRootNode);
    if (!rootNode) {
      if (activateNode && reactFlowInstance) {
        onLoad(reactFlowInstance); // 自动缩放和居中视图大小
      }

      return;
    }

    // 以源节点为中心居中视图
    centerNodePosition(rootNode, reactFlowInstance);

    // 默认展示根节点详情
    if (activateNode) {
      onNodeClick(rootNode);
    }
  }

  // 更新血缘数据时，重新渲染
  useEffect(() => {
    redrawLineage(entityLineage)
  }, [entityLineage])

  // 血缘呈现渲染
  const redrawLineage = (lineageData) => {
    // 全量节点去重
    const allNode = uniqWith([
      ...(lineageData.nodes ?? []),
      ...(lineageData.entity ? [lineageData.entity] : [])
    ], isEqual)

    // 生成组件需要的节点数据格式
    const updatedNodes = createNodes(
      allNode,
      lineageData?.edges ?? [],
      lineageData?.entity?.fullyQualifiedName,
      'COLUMN'
    )
    // 生成组件需要的连线数据格式
    const { edges: updatedEdges, columnsHavingLineage } = createEdges(
      allNode,
      lineageData?.edges ?? [],
      lineageData?.entity?.fullyQualifiedName,
    )
    // 更新画布上的血缘呈现
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    setColumnsHavingLineage(columnsHavingLineage);

    // 上下游节点数据分类
    const data = getUpstreamDownstreamNodesEdges(
      lineageData.edges ?? [],
      lineageData.nodes ?? [],
      lineageData?.entity?.fullyQualifiedName,
    )
    setUpstreamDownstreamData(data)

    // 当前选中的中心节点
    if (activeNode) {
      selectNode(activeNode);
    }
  }

  // 获取额外节点数据
  const loadChildNodesHandler = async (node, direction) => {
    try {
      const res = await getLineageDataByFQN(
        // {
        //   查询主表名 fqn: node.fullyQualifiedName
        //   血缘类型 type: node.entityType
        //   向上查询血缘层级 upstreamDepth: 1
        //   向下查询血缘层级 downstreamDepth: 1
        //   筛选域查询 query_filter: {"query":{"bool":{"must":[{"bool":{"should":[{"term":{"domain.displayName.keyword":"供应链-电饭煲产线"}}]}}]}}}
        //   查询已删除的 includeDeleted: false
        // }
      )

      const activeNode = nodes.find((n) => n.id === node.id);
      if (activeNode) {
        setActiveNode(activeNode);
      }

      const allNodes = uniqWith(
        [...(entityLineage?.nodes ?? []), ...(res.nodes ?? []), res.entity],
        isEqual
      );
      const allEdges = uniqWith(
        [...(entityLineage?.edges ?? []), ...(res.edges ?? [])],
        isEqual
      );

      setEntityLineage((prev) => {
        return {
          ...prev,
          nodes: allNodes,
          edges: allEdges,
        };
      });
    } catch (err) {
      console.log(err)
    }
  }

  // 选中后居中画布
  const selectNode = (node) => {
    centerNodePosition(node, reactFlowInstance);
  };

  // 初始化插件，并获取对象实例
  const onInitReactFlow = (reactFlowInstance) => {
    setReactFlowInstance(reactFlowInstance);
  };

  // 血缘连接线高亮
  const onColumnHighlight = (column = '', targetColumn = '') => {
    setSelectedColumn(column);
    const { columnEdge } = getClassifiedEdge(edges);
    const { connectedColumnEdges } = getAllTracedColumnEdge(
      column,
      columnEdge,
      targetColumn
    );

    setTracedColumns(connectedColumnEdges);
  }

  // 节点点击事件
  const onNodeClick = (node) => {
    if (!node) {
      return;
    }

    if (node.type === EntityLineageNodeType.LOAD_MORE) {
      // 更多节点出发事件
      selectLoadMoreNode(node);
    } else {
      // 当前节点的点击操作
      // 清空选中的连接线
      setSelectedEdge(undefined);
      // 保存触发的节点
      setActiveNode(node);
      // 保存选中的节点
      setSelectedNode(node.data.node);
      // 打开详情抽屉
      setIsDrawerOpen(true);
      // 血缘节点追溯连线高亮
      // handleLineageTracing(node);
    }
  };

  // 连接线点击事件
  const onEdgeClick = (edge) => {
    // 保存选中的连接线
    setSelectedEdge(edge);
    // 清空触发节点
    setActiveNode(undefined);
    // 清空选中的节点
    setSelectedNode({});
    // 打开详情抽屉
    setIsDrawerOpen(true);
  };

  // 点击面板清空所有
  const onPaneClick = () => {
    setIsDrawerOpen(false);
    setTracedNodes([]);
    setTracedColumns([]);
    setActiveNode(undefined);
    setSelectedNode({});
  };

  // 血缘节点追溯连线高亮（备用）
  const handleLineageTracing = (selectedNode) => {
    const { normalEdge } = getClassifiedEdge(edges);
    const incomingNode = getAllTracedNodes(
      selectedNode,
      nodes,
      normalEdge,
      [],
      true
    );
    const outgoingNode = getAllTracedNodes(
      selectedNode,
      nodes,
      normalEdge,
      [],
      false
    );
    const incomerIds = incomingNode.map((incomer) => incomer.id);
    const outgoerIds = outgoingNode.map((outGoer) => outGoer.id);
    const connectedNodeIds = [...outgoerIds, ...incomerIds, selectedNode.id];
    setTracedNodes(connectedNodeIds);
    setTracedColumns([]);
  }

  // 获取超出限制的血缘节点
  const selectLoadMoreNode = (node) => {
    const { pagination_data, edgeType } = node.data.node;
    setPaginationData(
      (prevState) => {
        const { parentId, index } = pagination_data;
        const updatedParentData = prevState[parentId] || {
          upstream: [],
          downstream: [],
        };
        const updatedIndexList =
          edgeType === EdgeTypeEnum.DOWN_STREAM
            ? {
                upstream: updatedParentData.upstream,
                downstream: [index],
              }
            : {
                upstream: [index],
                downstream: updatedParentData.downstream,
              };

        const retnObj = {
          ...prevState,
          [parentId]: updatedIndexList,
        };
        if (entityLineage) {
          // 使用新的位置获取额外血缘数据
          initLineageChildMaps(entityLineage, childMap, retnObj);
        }

        return retnObj;
      }
    );
  };

  // 重新初始化血缘呈现
  const initLineageChildMaps = (
    lineageData,
    childMapObj,
    paginationObj
  ) => {
    if (lineageData && childMapObj) {
      const { nodes: newNodes, edges } = getPaginatedChildMap(
        lineageData,
        childMapObj,
        paginationObj,
        lineageConfig.nodesPerLayer
      );

      setEntityLineage({
        ...entityLineage,
        nodes: newNodes,
        edges: [...(entityLineage.edges ?? []), ...edges],
      });
    }
  }

  // 节点展开收缩事件
  const onNodeCollapse = (node, direction) => {
    const { nodeFqn, edges: connectedEdges } = getConnectedNodesEdges(
      node,
      nodes,
      edges,
      direction
    );

    // 当前选中的节点
    setActiveNode(node);

    // 更新的节点，排除掉nodeFqn中包含的节点，就是目前收缩节点没有关联的相关节点
    const updatedNodes = (entityLineage.nodes ?? []).filter(
      (item) => !nodeFqn.includes(item.fullyQualifiedName ?? '')
    );
    // 更新的连接线，排除掉entityLineage.edges中包含connectedEdges中的连线数据，就是目前收缩节点没有关联的相关连线
    const updatedEdges = (entityLineage.edges ?? []).filter((val) => {
      return !connectedEdges.some(
        (connectedEdge) => connectedEdge.data.edge === val
      );
    });

    // 更新血缘数据
    setEntityLineage((pre) => {
      return {
        ...pre,
        nodes: updatedNodes,
        edges: updatedEdges,
      };
    });
  }

  const activityFeedContextValues = {
    nodes,
    edges,
    selectedNode,
    expandAllColumns,
    columnsHavingLineage,
    tracedColumns,
    tracedNodes,
    upstreamDownstreamData,
    onInitReactFlow,
    onEdgesChange,
    onNodesChange,
    loadChildNodesHandler,
    onColumnHighlight,
    onNodeCollapse,
    onNodeClick,
    onEdgeClick,
    onPaneClick
  }

  return (
    <LineageContext.Provider value={activityFeedContextValues}>
      {children}
      
      <Drawer
          title="详情"
          placement='right'
          onClose={() => setIsDrawerOpen(false)}
          open={isDrawerOpen}
          mask={false}
      >
          <p>{JSON.stringify(selectedNode)}</p>
          <p>{JSON.stringify(selectedEdge)}</p>
      </Drawer>
    </LineageContext.Provider> 
  )
}

export const useLineageProvider = () => useContext(LineageContext);

export default LineageApp
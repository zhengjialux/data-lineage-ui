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
  onLoad
} from './lineageUtils'
import { EntityLineageNodeType, EntityLineageDirection } from './entity.enum'
import { useNodesState, useEdgesState } from '@xyflow/react'
import { getLineageDataByFQN } from '../../serviceApi/getLineageDataApi'

export const LineageContext = createContext({});

const LineageApp = ({ children }) => {
  const [childMap, setChildMap] = useState({})
  const [lineageConfig, setLineageConfig] = useState({
    upstreamDepth: 3,
    downstreamDepth: 3,
    nodesPerLayer: 50,
  });
  const [columnsHavingLineage, setColumnsHavingLineage] = useState([]);
  // 血缘关系对象
  const [entityLineage, setEntityLineage] = useState({})
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [upstreamDownstreamData, setUpstreamDownstreamData] = useState({
    downstreamEdges: [],
    upstreamEdges: [],
    downstreamNodes: [],
    upstreamNodes: [],
  });
  const [activeNode, setActiveNode] = useState();
  const [reactFlowInstance, setReactFlowInstance] = useState();
  const [selectedNode, setSelectedNode] = useState({});
  const [expandAllColumns, setExpandAllColumns] = useState(true);  // 打开字段
  const [tracedColumns, setTracedColumns] = useState([]);
  const [tracedNodes, setTracedNodes] = useState([]);
  const [selectedColumn, setSelectedColumn] = useState('');

  useEffect(() => {
    getLineageDataByFQN(
      // {
      //   查询主表名 fqn: DPE-MySQL.data_test.cascade_connection_test.cdc_table
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

  // useEffect(() => {
  //   repositionLayout();
  // }, [expandAllColumns]);

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
    if (activateNode) {
      onNodeClick(rootNode);
    }
  }

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

  // 当前节点详情
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

  const onInitReactFlow = (reactFlowInstance) => {
    setReactFlowInstance(reactFlowInstance);
  };

  const toggleColumnView = () => {
    const updatedVal = !expandAllColumns;
    setExpandAllColumns(updatedVal);
  };

  const onColumnHighlight = (column) => {
    setSelectedColumn(column);
    const { columnEdge } = getClassifiedEdge(edges);
    const { connectedColumnEdges } = getAllTracedColumnEdge(
      column,
      columnEdge
    );

    setTracedColumns(connectedColumnEdges);
  }

  const onNodeClick = (node) => {
    if (!node) {
      return;
    }

    if (node.type === EntityLineageNodeType.LOAD_MORE) {
      // selectLoadMoreNode(node);
    } else {
      // setSelectedEdge(undefined);
      setActiveNode(node);
      setSelectedNode(node.data.node);
      // setIsDrawerOpen(true);
      // handleLineageTracing(node);
    }
  };

  const onNodeCollapse = () => {

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
    toggleColumnView,
    onColumnHighlight,
    onNodeCollapse,
    onNodeClick
  }

  return (
    <LineageContext.Provider value={activityFeedContextValues}>
      {children}
    </LineageContext.Provider> 
  )
}

export const useLineageProvider = () => useContext(LineageContext);

export default LineageApp
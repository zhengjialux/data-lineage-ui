import { useEffect, useState, Fragment, useMemo } from 'react';
import { useLineageProvider } from './LineageProvider'
import classNames from 'classnames'
import { EntityLineageNodeType, Position, DATATYPES_HAVING_SUBFIELDS, NODE_WIDTH, EdgeTypeEnum } from './entity.enum'
import { Handle, getOutgoers, getIncomers } from '@xyflow/react'
import { Button, Collapse, Divider, Typography } from 'antd';
import { DownOutlined, UpOutlined } from '@ant-design/icons';
import { getEntityChildrenAndLabel, getEntityName, encodeLineageHandles, checkUpstreamDownstream } from './lineageUtils'
import { isEmpty } from 'lodash'
import LineageNodeLabel from './LineageNodeLabel'
import MinusIcon from '../../assets/control-minus.svg';
import PlusIcon from '../../assets/plus-outlined.svg';
import './entity-lineage.style.less';
import './custom-node.less';

const { Panel } = Collapse

const CustomNode = (props) => {
    const { data, type } = props;

    const {
        nodes,
        edges,
        selectedNode,
        expandAllColumns,
        tracedColumns,
        tracedNodes,
        upstreamDownstreamData,
        columnsHavingLineage,
        loadChildNodesHandler,
        onColumnHighlight,
        onNodeCollapse
    } = useLineageProvider()
    // 节点数据
    const { label, isNewNode, node = {}, isRootNode } = data;
    const isSelected = selectedNode === node;
    const { id, lineage, fullyQualifiedName } = node;
    // 字段点击后高亮状态
    const [isTraced, setIsTraced] = useState(false);
    // 字段数据
    const [filteredColumns, setFilteredColumns] = useState([]);
    // 字段收起展开状态
    const [isExpanded, setIsExpanded] = useState(true);

    const { children, childrenHeading } = getEntityChildrenAndLabel(node);

    useEffect(() => {
        if (!isEmpty(children)) {
          setFilteredColumns(children);
        }
    }, [children]);

    useEffect(() => {
      setIsTraced(tracedNodes.includes(id));
    }, [tracedNodes, id]);

    const { isUpstreamNode, isDownstreamNode } = useMemo(() => {
      return {
        isUpstreamNode: upstreamDownstreamData.upstreamNodes.some(
          (item) => item.fullyQualifiedName === fullyQualifiedName
        ),
        isDownstreamNode: upstreamDownstreamData.downstreamNodes.some(
          (item) => item.fullyQualifiedName === fullyQualifiedName
        ),
      }
    }, [fullyQualifiedName, upstreamDownstreamData])

    const getActiveNode = (nodeId) => {
      return nodes.find((item) => item.id === nodeId);
    }

    // 展开节点
    const onExpand = (direction) => {
      loadChildNodesHandler(node, direction);
    }
    
    // 收缩节点
    const onCollapse = (direction = EdgeTypeEnum.DOWN_STREAM) => {
      const node = getActiveNode(id);
      if (node) {
        onNodeCollapse(node, direction);
      }
    }

    // 返回展开收缩句柄，赋值对应事件处理函数
    const getExpandCollapseHandles = () => {
      return (
        <>
          {hasOutgoers &&
            (isDownstreamNode || isRootNode) &&
            getCollapseHandle(EdgeTypeEnum.DOWN_STREAM, onCollapse)}
          {isDownstreamLeafNode &&
            (isDownstreamNode || isRootNode) &&
            getExpandHandle(EdgeTypeEnum.DOWN_STREAM, () =>
              onExpand(EdgeTypeEnum.DOWN_STREAM)
            )}
          {hasIncomers &&
            (isUpstreamNode || isRootNode) &&
            getCollapseHandle(EdgeTypeEnum.UP_STREAM, () =>
              onCollapse(EdgeTypeEnum.UP_STREAM)
            )}
          {isUpstreamLeafNode &&
            (isUpstreamNode || isRootNode) &&
            getExpandHandle(EdgeTypeEnum.UP_STREAM, () =>
              onExpand(EdgeTypeEnum.UP_STREAM)
            )}
        </>
      )
    }

    const { hasDownstream, hasUpstream } = useMemo(() => {
      return checkUpstreamDownstream(id, lineage ?? []);
    }, [id, lineage]);
  
    const { hasOutgoers, hasIncomers, isUpstreamLeafNode, isDownstreamLeafNode } = useMemo(() => {
      const activeNode = getActiveNode(id);
      if (!activeNode) {
        return {
          hasOutgoers: false,
          hasIncomers: false,
          isUpstreamLeafNode: false,
          isDownstreamLeafNode: false,
        };
      }
      const outgoers = getOutgoers(activeNode, nodes, edges);
      const incomers = getIncomers(activeNode, nodes, edges);

      return {
        hasOutgoers: outgoers.length > 0,
        hasIncomers: incomers.length > 0,
        isUpstreamLeafNode: incomers.length === 0 && hasUpstream,
        isDownstreamLeafNode: outgoers.length === 0 && hasDownstream,
      };
    }, [id, nodes, edges, hasUpstream, hasDownstream])

    // 节点收缩的句柄
    const getCollapseHandle = (
        direction,
        onClickHandler
      ) => {
        return (
          <Button
            className={classNames(
              'absolute lineage-node-minus lineage-node-handle flex-center',
              direction === EdgeTypeEnum.DOWN_STREAM
                ? 'react-flow__handle-right'
                : 'react-flow__handle-left'
            )}
            icon={<img src={MinusIcon} className="lineage-expand-icon" />}
            shape="circle"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onClickHandler();
            }}
          />
        );
      }

    // 节点展开的句柄
    const getExpandHandle = (
        direction,
        onClickHandler
      ) => {
        return (
          <Button
            className={classNames(
              'absolute lineage-node-handle flex-center',
              direction === EdgeTypeEnum.DOWN_STREAM
                ? 'react-flow__handle-right'
                : 'react-flow__handle-left'
            )}
            icon={<img src={PlusIcon} className="lineage-expand-icon" />}
            shape="circle"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onClickHandler();
            }}
          />
        );
      };

    const isColumnVisible = (record) => {
        if(expandAllColumns) { return true }
        return columnsHavingLineage.includes(record.fullyQualifiedName ?? '');
    }

    // 获取字段值内容
    const getColumnContent = (
        column,
        isColumnTraced,
        onColumnHighlight = () => {}
    ) => {
        const { fullyQualifiedName } = column;

        return (
          <div
            className={classNames(
              'custom-node-column-container custom-node-column-lineage-normal bg-white'
            )}
            key={fullyQualifiedName}
            onMouseEnter={(e) => {
              e.stopPropagation();
              onColumnHighlight(fullyQualifiedName ?? '');
            }}
            onMouseLeave={(e) => {
              e.stopPropagation();
              onColumnHighlight('');
            }}
          >
            {getColumnHandle(
              EntityLineageNodeType.DEFAULT,
              'lineage-column-node-handle',
              encodeLineageHandles(fullyQualifiedName ?? '')
            )}
    
            <Typography.Text
              className="p-xss p-x-lg"
              ellipsis={{ tooltip: true }}
              style={{ maxWidth: NODE_WIDTH }}>
              {getEntityName(column)}
            </Typography.Text>
          </div>
        )
    }

    // 获取字段的句柄
    const getColumnHandle = (
        nodeType,
        className,
        id
      ) => {
        if (nodeType === EntityLineageNodeType.NOT_CONNECTED) {
          return null;
        } else {
          return (
            <Fragment>
              {getHandleByType(Position.Left, 'target', className, id)}
              {getHandleByType(
                Position.Right,
                'source',
                className,
                id
              )}
            </Fragment>
          );
        }
      };

      // 字段句柄
      const getHandleByType = (
        position,
        type,
        className,
        id
      ) => {
        return (
          <Handle
            className={className}
            id={id}
            isConnectable={false} // 是否可操作连接交互
            position={position}
            type={type}
          />
        );
      };

      // 字段下关联字段的折叠布局（未验证）
    const renderRecord = (record) => {
        const isColumnTraced = tracedColumns.includes(
            record.fullyQualifiedName ?? ''
          );
          const headerContent = getColumnContent(
            record,
            isColumnTraced,
            onColumnHighlight
          );
    
          if (!record.children || record.children.length === 0) {
            if (!isColumnVisible(record)) {
              return null;
            }
    
            return headerContent;
          }
    
          return (
            <Collapse
              destroyInactivePanel
              className="lineage-collapse-column"
              defaultActiveKey={record.fullyQualifiedName}
              expandIcon={() => null}
              key={record.fullyQualifiedName}>
              <Panel header={headerContent} key={record.fullyQualifiedName ?? ''}>
                {record?.children?.map((child) => {
                  const { fullyQualifiedName, dataType } = child;
                  if (DATATYPES_HAVING_SUBFIELDS.includes(dataType)) {
                    return renderRecord(child);
                  } else {
                    const isColumnTraced = tracedColumns.includes(
                      fullyQualifiedName ?? ''
                    );
    
                    if (!isColumnVisible(child)) {
                      return null;
                    }
    
                    return getColumnContent(
                      child,
                      isColumnTraced,
                      onColumnHighlight
                    );
                  }
                })}
              </Panel>
            </Collapse>
          );
    }

    // 字段渲染
    const renderColumnsData = (column) => {
        const { fullyQualifiedName, dataType } = column;
        
        if (DATATYPES_HAVING_SUBFIELDS.includes(dataType)) {
          return renderRecord(column);
        } else {
          // 字段列表走这里
          const isColumnTraced = tracedColumns.includes(fullyQualifiedName ?? '');
          if (!isColumnVisible(column)) {
            return null;
          }
  
          return getColumnContent(
            column,
            isColumnTraced,  // 是否跟踪字段的血缘
            onColumnHighlight    // 字段点击操作
          );
        }
    }

    // 节点连线实体
    const getHandle = () => {
        switch (type) {
            case EntityLineageNodeType.OUTPUT:
              return (
                <>
                  <Handle
                    className="lineage-node-handle"
                    id={id}
                    isConnectable={false}  // 是否可操作连接交互
                    position={Position.Left}
                    type="target"
                  />
                  {getExpandCollapseHandles()}
                </>
              );
      
            case EntityLineageNodeType.INPUT:
              return (
                <>
                  <Handle
                    className="lineage-node-handle"
                    id={id}
                    isConnectable={false}  // 是否可操作连接交互
                    position={Position.Right}
                    type="source"
                  />
                  {getExpandCollapseHandles()}
                </>
              );
      
            case EntityLineageNodeType.NOT_CONNECTED:
              return null;
      
            default:
              return (
                <>
                  <Handle
                    className="lineage-node-handle"
                    id={id}
                    isConnectable={false}  // 是否可操作连接交互
                    position={Position.Left}
                    type="target"
                  />
                  <Handle
                    className="lineage-node-handle"
                    id={id}
                    isConnectable={false}  // 是否可操作连接交互
                    position={Position.Right}
                    type="source"
                  />
                  {getExpandCollapseHandles()}
                </>
              );
          }
    }

    // 当前节点的全称
    const entityName = getEntityName(node)

    return (
        <div
            className={classNames(
                'lineage-node p-0',
                isSelected ? 'custom-node-header-active' : 'custom-node-header-normal',
                // { 'custom-node-header-tracing': isTraced }
            )}
        >
            {getHandle()}
            <div className="lineage-node-content">
              <div className="label-container bg-white">
                <LineageNodeLabel node={node} />
                <div
                  style={{color: '#999'}}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded((prevIsExpanded) => !prevIsExpanded);
                  }}
                  > 列 
                  {isExpanded ? (
                    <UpOutlined style={{ fontSize: '12px' }} />
                  ) : (
                    <DownOutlined style={{ fontSize: '12px' }} />
                  )}
                  </div>
                <Typography.Text
                  style={{ fontWeight: 'bold' }}
                  ellipsis={{ tooltip: entityName }}
                >
                  {entityName}
                </Typography.Text>
              </div>
              <Divider style={{ marginBottom: 0 }} />
              {/* 字段列表的显示控制 */}
              {isExpanded && (
                <div className="lineage-node-content">
                  {/* 字段渲染 */}
                  {filteredColumns.map((column) =>
                    renderColumnsData(column)
                  )}
              </div>
              )}
          </div>
        </div>
    )
}

export default CustomNode
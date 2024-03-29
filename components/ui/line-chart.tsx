import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

const MARGIN = { top: 15, right: 16, bottom: 20, left: 28 };

type Datapoint = { createdAt: Date; rating: number };

type LineChartProps = {
  width: number;
  height: number;
  data: Datapoint[];
  offset: (d: Date) => Date;
};

export const LineChart = ({
  width,
  height,
  data: data_,
  offset,
}: LineChartProps) => {
  const axesRef = useRef(null);
  const [cursorPosition, setCursorPosition] = useState<number | null>(null);

  const boundsWidth = Math.max(width - MARGIN.right - MARGIN.left, 0);
  const boundsHeight = Math.max(height - MARGIN.top - MARGIN.bottom, 0);

  // Start and end of the axis must be in the Date format
  const start = offset(new Date(Date.now()));
  const end = new Date(Date.now());

  // Extend left and right of line graph
  const data = useMemo<Datapoint[]>(() => {
    const ans = [...data_];
    if (!ans.length || ans[0].createdAt > start) {
      ans.unshift({ createdAt: start, rating: ans[0].rating });
    }
    ans.push({
      createdAt: new Date(),
      rating: data_[data_.length - 1]?.rating || 1500,
    });
    return ans;
  }, [data_, start]);

  const yScale = useMemo(() => {
    // calculate y range based on data
    let [min, max] = d3.extent(
      data.filter((d) => d.createdAt > start && d.createdAt <= end),
      (d) => d.rating
    ) as [number, number];
    const padding = max - min ? (max - min) * 0.1 : 10;
    min = Math.max(min - padding, 0);
    max = Math.min(max + padding, 4000);
    return d3.scaleLinear().domain([min, max]).range([boundsHeight, 0]);
  }, [boundsHeight, data]);

  const xScale = useMemo(() => {
    return d3.scaleTime().domain([start, end]).range([0, boundsWidth]);
  }, [start, end, boundsWidth]);

  // Render the X and Y axis using d3.js, not react
  useEffect(() => {
    const formatMillisecond = d3.timeFormat('.%L'),
      formatSecond = d3.timeFormat(':%S'),
      formatMinute = d3.timeFormat('%H:%M'),
      formatHour = d3.timeFormat('%I %p'),
      formatDay = d3.timeFormat('%a %d'),
      formatWeek = d3.timeFormat('%b %e'),
      formatMonth = d3.timeFormat('%b'),
      formatYear = d3.timeFormat('%Y');

    function multiFormat(date: Date | d3.NumberValue, i: number) {
      // if (i % 2 === 0) return '';
      if (date instanceof Date) {
        return (
          d3.timeSecond(date) < date
            ? formatMillisecond
            : d3.timeMinute(date) < date
              ? formatSecond
              : d3.timeHour(date) < date
                ? formatMinute
                : d3.timeDay(date) < date
                  ? formatHour
                  : d3.timeMonth(date) < date
                    ? d3.timeWeek(date) < date
                      ? formatDay
                      : formatWeek
                    : d3.timeYear(date) < date
                      ? formatMonth
                      : formatYear
        )(date);
      } else {
        return date.toString();
      }
    }

    const svgElement = d3.select(axesRef.current);
    svgElement.selectAll('*').remove();

    const xAxisGenerator = d3
      .axisBottom(xScale)
      // .ticks(4)
      .tickSizeOuter(0)
      .tickFormat(multiFormat);

    svgElement
      .append('g')
      .attr('transform', 'translate(0,' + boundsHeight + ')')
      .call(xAxisGenerator)
      .call((g) => g.select('.domain').attr('stroke-opacity', 0.5))
      .call((g) =>
        g
          .selectAll('.tick line')
          .attr('stroke-opacity', 0.5)
          .attr('stroke-dasharray', '4,2')
      )
      .call((g) => g.selectAll('.tick text').attr('id', 'axis'));

    const yAxisGenerator = d3.axisLeft(yScale).tickSize(-boundsWidth).ticks(3);
    // .tickFormat((d) => {
    //   return Math.floor(d.valueOf() / 1000) + 'k';
    // });
    svgElement
      .append('g')
      .call(yAxisGenerator)
      .call((g) => g.select('.domain').remove())
      .call((g) =>
        g
          .selectAll('.tick line')
          .attr('stroke-opacity', 0.2)
          .attr('stroke-dasharray', '4,2')
      )
      .call((g) =>
        g.selectAll('.tick:first-of-type line').attr('stroke-opacity', 0)
      )
      .call((g) => g.selectAll('.tick text').attr('id', 'axis'));
    // .call((g) => g.selectAll('.tick text').attr('x', 4).attr('dy', -4));
  }, [xScale, yScale, boundsWidth, boundsHeight]);

  const areaBuilder = d3
    .area<Datapoint>()
    .x((d) => xScale(d.createdAt))
    .y1((d) => yScale(d.rating))
    .y0(yScale(0));
  const areaPath = areaBuilder(data);

  const lineBuilder = d3
    .line<Datapoint>()
    .x((d) => xScale(d.createdAt))
    .y((d) => yScale(d.rating));
  const linePath = lineBuilder(data);

  if (!linePath || !areaPath) {
    return null;
  }

  const getClosestPoint = (cursorPixelPosition: number) => {
    const x = xScale.invert(cursorPixelPosition);

    let minDistance = Infinity;
    let closest: Datapoint = data[0];

    for (const point of data) {
      const distance = Math.abs(point.createdAt.getTime() - x.getTime());
      if (distance < minDistance) {
        minDistance = distance;
        closest = point;
      }
    }

    return closest;
  };

  const onMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    const closest = getClosestPoint(mouseX);

    setCursorPosition(xScale(closest.createdAt));
  };

  return (
    <div>
      <svg width={width} height={height}>
        <defs>
          <clipPath id='clip'>
            <rect width={boundsWidth} height={boundsHeight} x={0} y={0} />
          </clipPath>
        </defs>
        {/* Second is for the axes */}
        <g
          width={boundsWidth}
          height={boundsHeight}
          ref={axesRef}
          transform={`translate(${[MARGIN.left, MARGIN.top].join(',')})`}
        />
        {/* first group is lines */}
        <g
          width={boundsWidth}
          height={boundsHeight}
          transform={`translate(${[MARGIN.left, MARGIN.top].join(',')})`}
        >
          <g clipPath='url(#clip)'>
            <path
              id='area'
              d={areaPath}
              opacity={1}
              stroke='none'
              fillOpacity={0.3}
            />
            <path d={linePath} fill={'none'} strokeWidth={2} id='line' />
          </g>
          {cursorPosition && (
            <>
              <Cursor
                height={boundsHeight}
                x={cursorPosition}
                y={yScale(getClosestPoint(cursorPosition)?.rating)}
              />
              <g
                transform={`translate(${cursorPosition},${yScale(getClosestPoint(cursorPosition)?.rating)})`}
              >
                <rect
                  x={-16}
                  y={-27.5}
                  width={32}
                  height={20}
                  // rx={7}
                  id='labelRect'
                  ry={10}
                />
                <text x={0} y={-14} textAnchor='middle' id='labelText'>
                  {Math.round(getClosestPoint(cursorPosition)?.rating)}
                </text>
              </g>
            </>
          )}
          <rect
            x={0}
            y={0}
            width={boundsWidth}
            height={boundsHeight}
            onMouseMove={onMouseMove}
            onMouseLeave={() => setCursorPosition(null)}
            visibility={'hidden'}
            pointerEvents={'all'}
          />
        </g>
      </svg>
    </div>
  );
};

type CursorProps = {
  x: number;
  y: number;
  height: number;
};

const Cursor = ({ x, y, height }: CursorProps) => {
  return (
    <>
      {/* <line x1={x} x2={x} y1={0} y2={height} stroke={'white'} strokeWidth={1} /> */}
      <circle cx={x} cy={y} r={5} id='circle' />
    </>
  );
};
